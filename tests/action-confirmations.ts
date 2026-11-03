import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * SCRUM-270 — TC-132-09's audit, read from the source instead of by hand:
 * which server actions each client component calls, and what the code that
 * handles each reply does with it. It reads the code as text, so it proves
 * the handler shows a confirmation and the refusal's message, not that the
 * page renders them; each story's own e2e tests do that.
 */

export type Source = { path: string; text: string };

/** One place a client component sends an action and handles its reply. */
export type Call = {
  file: string;
  line: number;
  action: string;
  /** The function that awaits the reply. */
  handler: string;
  /** The variable the reply is held in, or null when it isn't kept. */
  reply: string | null;
};

const parse = ({ path, text }: Source) =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const isDirective = (text: string, directive: string) =>
  new RegExp(`^\\s*["']${directive}["']`).test(text);

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function sourcesUnder(dir: string, extension: string, found: Source[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourcesUnder(path, extension, found);
    else if (entry.name.endsWith(extension)) {
      found.push({ path, text: readFileSync(path, "utf8") });
    }
  }
  return found;
}

/** The repo's client components, and its "use server" modules by path. */
export function readRepo(root = process.cwd()) {
  const clients = ["app", "components"]
    .flatMap((dir) => sourcesUnder(join(root, dir), ".tsx"))
    .filter(({ text }) => isDirective(text, "use client"));
  const servers = new Map(
    ["app", "lib"]
      .flatMap((dir) => sourcesUnder(join(root, dir), ".ts"))
      .filter(({ text }) => isDirective(text, "use server"))
      .map((source) => [resolve(source.path), source]),
  );
  const named = (path: string) => relative(root, path).replaceAll("\\", "/");
  return { root, clients, servers, named };
}

/** The "use server" module an import specifier names, if it is one. */
export function serverModule(
  from: string,
  specifier: string,
  servers: Map<string, Source>,
  root = process.cwd(),
) {
  const base = specifier.startsWith("@/")
    ? join(root, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (!base) return undefined;
  return servers.get(resolve(`${base}.ts`));
}

/** Each action a client component imports, with the module it comes from. */
export function actionImports(
  client: Source,
  servers: Map<string, Source>,
  root = process.cwd(),
) {
  const imports: { action: string; server: Source }[] = [];
  for (const statement of parse(client).statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const server = serverModule(
      client.path,
      (statement.moduleSpecifier as ts.StringLiteral).text,
      servers,
      root,
    );
    const bindings = statement.importClause?.namedBindings;
    if (!server || !bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (!element.isTypeOnly) imports.push({ action: element.name.text, server });
    }
  }
  return imports;
}

function enclosingFunction(node: ts.Node): ts.SignatureDeclaration | undefined {
  for (let up = node.parent; up; up = up.parent) {
    if (
      ts.isArrowFunction(up) ||
      ts.isFunctionDeclaration(up) ||
      ts.isFunctionExpression(up) ||
      ts.isMethodDeclaration(up)
    ) {
      return up;
    }
  }
  return undefined;
}

/**
 * Where the reply ends up: climbs out of `await`, `a ? b : c`, a wrapper
 * like `sendRequest(() => x(…))`, to the `const result =` or `reply =` that
 * keeps it. Returns the node that keeps it, or the call itself when nothing does.
 */
function keeperOf(call: ts.CallExpression): { node: ts.Node; reply: string | null } {
  let node: ts.Node = call;
  for (let up = node.parent; up; node = up, up = up.parent) {
    if (ts.isVariableDeclaration(up) && ts.isIdentifier(up.name)) {
      return { node: up, reply: up.name.text };
    }
    if (
      ts.isBinaryExpression(up) &&
      up.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(up.left)
    ) {
      return { node: up, reply: up.left.text };
    }
    const passesThrough =
      ts.isAwaitExpression(up) ||
      ts.isParenthesizedExpression(up) ||
      ts.isConditionalExpression(up) ||
      (ts.isArrowFunction(up) && up.body === node) ||
      (ts.isCallExpression(up) && up.arguments.includes(node as ts.Expression));
    if (!passesThrough) break;
  }
  return { node: call, reply: null };
}

function callAt(sourceFile: ts.SourceFile, file: string, action: string, call: ts.CallExpression) {
  const { node, reply } = keeperOf(call);
  return {
    file,
    line: sourceFile.getLineAndCharacterOfPosition(call.getStart()).line + 1,
    action,
    handler: enclosingFunction(node)?.getText() ?? "",
    reply,
  };
}

/** Each action awaited inside `handler`, whatever it is called there. */
function awaitedIn(handler: ts.Node, visit: (call: ts.CallExpression) => void) {
  walk(handler, (node) => {
    if (
      ts.isAwaitExpression(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression)
    ) {
      visit(node.expression);
    }
  });
}

function insideType(node: ts.Node) {
  for (let up = node.parent; up; up = up.parent) if (ts.isTypeNode(up)) return true;
  return false;
}

/** The function declared in this file under `name`, if there is one. */
function localFunction(sourceFile: ts.SourceFile, name: string) {
  let found: ts.Node | undefined;
  walk(sourceFile, (node) => {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      ts.isArrowFunction(node.initializer)
    ) {
      found = node.initializer;
    }
  });
  return found;
}

/**
 * Every place `client` sends one of `actions`. An action called by name is
 * handled where it is called. One passed to a function in the same file
 * (registration-control's `act(closeRegistration)`) is handled in that
 * function, and one kept in a table (readiness-checklist's SETTLE) wherever
 * the table is read. Anywhere else, such as `<form action={x}>`, it is sent
 * with no handler, which no check below accepts.
 */
export function actionCalls(client: Source, file: string, actions: Set<string>): Call[] {
  const sourceFile = parse(client);
  const calls = new Map<string, Call>();
  const add = (call: Call) => calls.set(`${call.line}:${call.action}`, call);
  walk(sourceFile, (node) => {
    if (!ts.isIdentifier(node) || !actions.has(node.text)) return;
    const action = node.text;
    const parent = node.parent;
    if (ts.isImportSpecifier(parent) || insideType(node)) return;
    // `{ save: … }` and `x.save` name a property, not the action.
    if ((ts.isPropertyAssignment(parent) || ts.isPropertyAccessExpression(parent)) && parent.name === node) {
      return;
    }
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
      return;
    }
    if (ts.isCallExpression(parent) && parent.expression === node) {
      add(callAt(sourceFile, file, action, parent));
      return;
    }
    const receiver =
      ts.isCallExpression(parent) && ts.isIdentifier(parent.expression)
        ? localFunction(sourceFile, parent.expression.text)
        : undefined;
    if (receiver) {
      awaitedIn(receiver, (call) => add(callAt(sourceFile, file, action, call)));
      return;
    }
    // A table is a variable whose value holds the action directly, with no
    // function in between (that would be a component or handler instead).
    let table: ts.Node | undefined = parent;
    while (table && !ts.isVariableDeclaration(table) && !ts.isFunctionLike(table)) {
      table = table.parent;
    }
    const name =
      table && ts.isVariableDeclaration(table) && ts.isIdentifier(table.name)
        ? table.name.text
        : null;
    let traced = false;
    if (name) {
      walk(sourceFile, (use) => {
        if (!ts.isIdentifier(use) || use.text !== name || use.parent === table) return;
        const handler = enclosingFunction(use);
        if (!handler) return;
        awaitedIn(handler, (call) => {
          traced = true;
          add(callAt(sourceFile, file, action, call));
        });
      });
    }
    if (!traced) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      add({ file, line, action, handler: "", reply: null });
    }
  });
  return [...calls.values()];
}

/** The handler confirms a success: a toast, or a status message. */
export const confirms = (call: Call) =>
  /\btoast\.(success|info)\(/.test(call.handler) || /role="status"/.test(call.handler);

/** The reply goes to other code whole: `showSaveReply(reply, …)`, or `return result`. */
const handsOn = (call: Call) =>
  call.reply !== null &&
  new RegExp(`(\\w\\(\\s*|\\breturn\\s+)${call.reply}\\s*[,);]`).test(call.handler);

/** The handler shows the refusal's own message, or hands the reply to code that does. */
export const showsRefusal = (call: Call) =>
  call.reply !== null &&
  (new RegExp(`\\b${call.reply}\\.error\\b`).test(call.handler) || handsOn(call));

/** The handler reads the reply's field errors, or hands the reply to code that does. */
export const readsFieldErrors = (call: Call) =>
  call.reply !== null &&
  (new RegExp(`\\b${call.reply}\\.fieldErrors\\b`).test(call.handler) || handsOn(call));

/**
 * Whether `action` in `server` can refuse with field errors: it, or a
 * function in its own module it calls, returns `err(message, fieldErrors)`.
 */
export function namesFields(server: Source, action: string) {
  const declarations = new Map<string, ts.Node>();
  for (const statement of parse(server).statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      declarations.set(statement.name.text, statement);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          declarations.set(declaration.name.text, declaration);
        }
      }
    }
  }
  const seen = new Set<string>();
  const search = (name: string): boolean => {
    const declaration = declarations.get(name);
    if (!declaration || seen.has(name)) return false;
    seen.add(name);
    let found = false;
    walk(declaration, (node) => {
      if (found || !ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
      const callee = node.expression.text;
      found = (callee === "err" && node.arguments.length >= 2) || search(callee);
    });
    return found;
  };
  return search(action);
}
