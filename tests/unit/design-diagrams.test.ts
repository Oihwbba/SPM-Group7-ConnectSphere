import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

// SCRUM-175 — the design diagrams are exported SVG images, which
// .gitattributes keeps out of the GLM review's diff. So the rules a reviewer
// would otherwise check by eye are checked here instead: no diagram can run
// code or load anything from outside the repo, and the index links every one.

const DESIGN = join(process.cwd(), "docs", "design");
const DIAGRAMS = join(DESIGN, "diagrams");
const svgs = readdirSync(DIAGRAMS).filter((file) => file.endsWith(".svg"));
const read = (file: string) => readFileSync(join(DIAGRAMS, file), "utf8");

/** What a diagram must not contain, each with the rule it breaks. */
const FORBIDDEN: [string, RegExp][] = [
  ["a script", /<script\b/i],
  ["an event handler attribute", /\son[a-z]+\s*=/i],
  ["a javascript: URL", /javascript:/i],
  ["an embedded page or object", /<(?:iframe|embed|object)\b/i],
  ["a stylesheet import", /@import\b/i],
  ["a stylesheet URL outside the file", /url\(\s*(?!["']?#)/i],
];

/** Every href in a diagram, which may only point inside the same file. */
function hrefs(svg: string): string[] {
  return [...svg.matchAll(/\b(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)].map(
    (m) => m[1],
  );
}

/** The tags inside foreignObject blocks, where Mermaid puts its HTML labels. */
function foreignObjectTags(svg: string): Set<string> {
  const tags = new Set<string>();
  for (const block of svg.matchAll(
    /<foreignObject\b[\s\S]*?<\/foreignObject>/gi,
  )) {
    for (const tag of block[0].matchAll(/<([a-zA-Z][\w:-]*)/g))
      tags.add(tag[1].toLowerCase());
  }
  return tags;
}

describe("SCRUM-175 design diagrams", () => {
  it("SCRUM-175 [AC1]: docs/design/diagrams holds the 33 diagrams", () => {
    expect(svgs).toHaveLength(33);
  });

  it.each(svgs)("SCRUM-175 [AC5]: %s contains no active content", (file) => {
    const svg = read(file);
    for (const [what, pattern] of FORBIDDEN) {
      expect(pattern.test(svg), `${file} contains ${what}`).toBe(false);
    }
  });

  it.each(svgs)("SCRUM-175 [AC5]: %s links only within itself", (file) => {
    expect(hrefs(read(file)).filter((href) => !href.startsWith("#"))).toEqual(
      [],
    );
  });

  it.each(svgs)(
    "SCRUM-175 [AC5]: %s uses only plain label markup inside foreignObject",
    (file) => {
      const allowed = new Set(["foreignobject", "div", "span", "p", "br"]);
      expect(
        [...foreignObjectTags(read(file))].filter((tag) => !allowed.has(tag)),
      ).toEqual([]);
    },
  );

  it("SCRUM-175 [AC2]: the index links every diagram exactly once, and every link resolves", () => {
    const index = readFileSync(join(DESIGN, "README.md"), "utf8");
    const links = [...index.matchAll(/\]\(diagrams\/([^)]+)\)/g)].map(
      (m) => m[1],
    );
    expect([...links].sort()).toEqual([...svgs].sort());
  });

  // The checks above must be able to fail: each forbidden pattern catches a
  // planted example, so a regex typo can't make them pass vacuously.
  it("SCRUM-175 [AC5]: each check catches a planted example", () => {
    const planted = [
      "<svg><script>alert(1)</script></svg>",
      '<svg><rect onload="x()"/></svg>',
      '<svg><a href="javascript:x()"/></svg>',
      '<svg><foreignObject><iframe src="x"/></foreignObject></svg>',
      "<svg><style>@import 'x.css';</style></svg>",
      "<svg><style>.a{fill:url('https://example.com/x')}</style></svg>",
    ];
    planted.forEach((svg, i) =>
      expect(FORBIDDEN[i][1].test(svg), FORBIDDEN[i][0]).toBe(true),
    );
    // An arrowhead marker in the same file is fine, quoted or not.
    expect(
      FORBIDDEN[5][1].test(
        `<path marker-end="url('#arrow')" d="M0"/><path marker-end="url(#a)"/>`,
      ),
    ).toBe(false);
    expect(
      hrefs('<svg><use href="https://example.com/x.svg#a"/></svg>'),
    ).toEqual(["https://example.com/x.svg#a"]);
    expect(
      foreignObjectTags(
        "<svg><foreignObject><div><img src=x></div></foreignObject></svg>",
      ).has("img"),
    ).toBe(true);
  });
});
