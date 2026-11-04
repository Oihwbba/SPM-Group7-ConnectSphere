import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import {
  actionCalls,
  actionImports,
  confirms,
  namesFields,
  readRepo,
  readsFieldErrors,
  showsRefusal,
  type Call,
  type Source,
} from "../action-confirmations";

// SCRUM-270 — TC-132-09's audit (SCRUM-132 AC4) as a test: every action that
// changes data confirms success, and shows a refusal's message at the field it
// names. Test cases: docs/testing/SCRUM-270.md.

const CHANGES_DATA = new Set([
  "addOperationalNote",
  "assignCoordinator",
  "cancelEvent",
  "changeEquipmentRequest",
  "closeRegistration",
  "confirmEvent",
  "confirmHold",
  "createDraftEvent",
  "createEquipmentRequest",
  "createVenue",
  "decideBookingRequest",
  "decideChangeRequest",
  "discardDraftEvent",
  "holdBookingRequest",
  "markNotificationRead",
  "raiseChangeRequest",
  "reassignCoordinator",
  "recordNoEquipmentNeeded",
  "recordSafetyCheckOutcome",
  "recordSuitabilityJudgement",
  "recordUnavailability",
  "registerForEvent",
  "rejectPlanningEvent",
  "releaseHold",
  "reopenRegistration",
  "reportUnprovidableEquipment",
  "requestClarification",
  "requestSafetyCheck",
  "reserveEquipmentRequest",
  "resolveReconsiderationFlag",
  "respondToClarification",
  "retireVenue",
  "startRequestFromRejected",
  "submitBookingRequest",
  "submitEventRequest",
  "suggestAlternativeEquipment",
  "transitionEventStatus",
  "updateEquipmentRequestStatus",
  "updateEventDetails",
  "updateVenue",
  "withdrawBookingRequest",
  "withdrawEquipmentRequest",
  "withdrawRegistration",
]);

// Reads, and signing in and out, which change the session rather than data:
// the page they open is the answer.
const CHANGES_NO_DATA = new Set([
  "authenticate",
  "canEditEventDetails",
  "checkVenueAvailability",
  "getAllEquipmentAvailability",
  "getChangeDecision",
  "getChangeRequestsForEvent",
  "getClarificationForEvent",
  "getEquipmentSchedule",
  "getEventArrangements",
  "getEventBookings",
  "getEventCoordinator",
  "getEventEquipment",
  "getEventFlags",
  "getEventReadiness",
  "getEventRegistrations",
  "getFlaggedArrangements",
  "getFormCatalogues",
  "getOperationalNotes",
  "getRegistrationControl",
  "isEventStillVisible",
  "signOutAction",
]);

const NO_CONFIRMATION: Record<string, string> = {
  markNotificationRead:
    "it happens as the notification opens, and the list or page it opens is the confirmation (TC-132-09)",
  decideBookingRequest:
    "approving or rejecting ends in the SCRUM-207 pop-up, which says what was decided (TC-211-18), not a toast",
};

const FIELD_ERRORS_NOT_READ: Record<string, string> = {
  markNotificationRead: "its only field is the notification's id, which the user doesn't type",
  registerForEvent: "its only field is the event's id, which the user doesn't type",
  closeRegistration: "its only field is the event's id, which the user doesn't type",
  reopenRegistration: "its only field is the event's id, which the user doesn't type",
  assignCoordinator:
    "the Coordinator is picked from a list, and Assign is disabled until one is",
  reassignCoordinator:
    "the Coordinator is picked from a list that starts on the current one",
  recordSuitabilityJudgement:
    "the refusal's message is the note's or the choice's, shown in the form's one error line under the note",
  addOperationalNote:
    "the refusal's message is the note's, shown in the error line under its only text box",
};

const repo = readRepo();
const imported = repo.clients.flatMap((client) =>
  actionImports(client, repo.servers).map((found) => ({ ...found, client })),
);
const serverOf = new Map(imported.map(({ action, server }) => [action, server]));
const writingCalls = repo.clients.flatMap((client) =>
  actionCalls(client, repo.named(client.path), CHANGES_DATA),
);
const where = (call: Call) => `${call.action} in ${call.file}:${call.line}`;

describe("TC-132-09's audit — SCRUM-270", () => {
  it("SCRUM-270 [AC1] TC-270-01: every action a client component imports is listed as changing data or not, and every listed action is imported", () => {
    const names = new Set(imported.map(({ action }) => action));
    const unlisted = [...names].filter(
      (action) => !CHANGES_DATA.has(action) && !CHANGES_NO_DATA.has(action),
    );
    const both = [...CHANGES_DATA].filter((action) => CHANGES_NO_DATA.has(action));
    const unused = [...CHANGES_DATA, ...CHANGES_NO_DATA].filter((action) => !names.has(action));

    expect(names.size).toBeGreaterThan(0);
    expect(unlisted, "list each in CHANGES_DATA or CHANGES_NO_DATA").toEqual([]);
    expect(both).toEqual([]);
    expect(unused, "no client component imports these any more").toEqual([]);
  });

  it("SCRUM-270 [AC2] TC-270-02: every call of an action that changes data confirms success", () => {
    const sent = new Set(writingCalls.map((call) => call.action));
    const silent = writingCalls
      .filter((call) => !(call.action in NO_CONFIRMATION) && !confirms(call))
      .map(where);

    expect([...CHANGES_DATA].filter((action) => !sent.has(action))).toEqual([]);
    expect(silent).toEqual([]);
  });

  it("SCRUM-270 [AC3] TC-270-03: every call of an action that changes data shows a refusal's message", () => {
    expect(writingCalls.filter((call) => !showsRefusal(call)).map(where)).toEqual([]);
  });

  it("SCRUM-270 [AC3] TC-270-04: where an action can refuse with field errors, its caller reads them", () => {
    const unread = writingCalls
      .filter(
        (call) =>
          !(call.action in FIELD_ERRORS_NOT_READ) &&
          namesFields(serverOf.get(call.action)!, call.action) &&
          !readsFieldErrors(call),
      )
      .map(where);

    expect(unread).toEqual([]);
  });

  it("SCRUM-270 [AC2, AC3] TC-270-05: each exception is still needed", () => {
    const callsOf = (action: string) => writingCalls.filter((call) => call.action === action);

    for (const action of Object.keys(NO_CONFIRMATION)) {
      expect(callsOf(action).length, action).toBeGreaterThan(0);
      expect(callsOf(action).some((call) => !confirms(call)), action).toBe(true);
    }
    for (const action of Object.keys(FIELD_ERRORS_NOT_READ)) {
      expect(callsOf(action).length, action).toBeGreaterThan(0);
      expect(namesFields(serverOf.get(action)!, action), action).toBe(true);
      expect(callsOf(action).some((call) => !readsFieldErrors(call)), action).toBe(true);
    }
  });
});

const client = (body: string): Source => ({
  path: "fixture.tsx",
  text: `"use client";\nimport { save } from "./actions";\n${body}`,
});
const callsIn = (body: string) => actionCalls(client(body), "fixture.tsx", new Set(["save"]));
const only = (body: string) => {
  const calls = callsIn(body);
  expect(calls).toHaveLength(1);
  return calls[0];
};

describe("what the audit accepts — SCRUM-270", () => {
  const confirmed = `
    function onSave() {
      startTransition(async () => {
        const result = await save({ note });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          toast.error(result.error);
          return;
        }
        toast.success("Saved.");
      });
    }`;

  it("SCRUM-270 [AC4] TC-270-06: a handler with no success toast or status fails, and one with either passes", () => {
    expect(confirms(only(confirmed))).toBe(true);
    expect(confirms(only(confirmed.replace('toast.success("Saved.");', "")))).toBe(false);
    expect(confirms(only(confirmed.replace("toast.success", "toast.info")))).toBe(true);
    // A toast elsewhere in the file isn't the handler's.
    expect(
      confirms(
        only(`
          function onSave() { startTransition(async () => { const result = await save(); }); }
          function other() { toast.success("Unrelated."); }`),
      ),
    ).toBe(false);
  });

  it("SCRUM-270 [AC4] TC-270-07: a handler that drops the refusal's message or its field errors fails", () => {
    const noFieldErrors = confirmed.replace("setErrors(result.fieldErrors ?? {});", "");
    const noMessage = noFieldErrors.replace("toast.error(result.error);", 'toast.error("Failed.");');

    expect(showsRefusal(only(confirmed))).toBe(true);
    expect(readsFieldErrors(only(confirmed))).toBe(true);
    expect(showsRefusal(only(noFieldErrors))).toBe(true);
    expect(readsFieldErrors(only(noFieldErrors))).toBe(false);
    expect(showsRefusal(only(noMessage))).toBe(false);
    // A reply never kept can't be shown.
    expect(showsRefusal(only("async function f() { await save(); toast.success('Saved.'); }"))).toBe(
      false,
    );
  });

  it("SCRUM-270 [AC4] TC-270-07: a reply handed on whole counts as shown", () => {
    const toHelper = only(`
      async function f() {
        const reply = await save();
        showSaveReply(reply, { close: (message) => toast.success(message) });
      }`);
    const returned = only(`
      async function f() {
        const result = await save();
        if (!result.ok) return result;
        toast.success("Done.");
        return result;
      }`);

    for (const call of [toHelper, returned]) {
      expect(confirms(call)).toBe(true);
      expect(showsRefusal(call)).toBe(true);
      expect(readsFieldErrors(call)).toBe(true);
    }
  });

  it("SCRUM-270 [AC1, AC4] TC-270-08: an action called through a wrapper, a local function or a table is traced to its handler, and one sent with no handler fails", () => {
    const wrapped = only(`
      function f() {
        startTransition(async () => {
          const result = ok ? await sendRequest(() => save(payload)) : err("Fix it.");
          if (result.ok) toast.success("Saved.");
        });
      }`);
    const passed = only(`
      function act(action: typeof save) {
        startTransition(async () => {
          const result = await action({ id });
          if (!result.ok) setError(result.error);
          else toast.success(action === save ? "Saved." : "Done.");
        });
      }
      const button = () => act(save);`);
    const table = only(`
      const ACTIONS = { save: [save, "Saved."] } as const;
      function run(how: keyof typeof ACTIONS) {
        const [action, done] = ACTIONS[how];
        startTransition(async () => {
          const result = await action({ id });
          if (!result.ok) toast.error(result.error);
          else toast.success(done);
        });
      }`);
    const formAction = only("export const Menu = () => <form action={save}><button /></form>;");

    for (const call of [wrapped, passed, table]) {
      expect(call.reply).toBe("result");
      expect(confirms(call)).toBe(true);
    }
    expect(formAction.handler).toBe("");
    expect(confirms(formAction)).toBe(false);
    expect(showsRefusal(formAction)).toBe(false);
  });

  it("SCRUM-270 [AC3] TC-270-09: an action refuses with field errors when it, or a function of its module it calls, passes them to err", () => {
    const server: Source = {
      path: "actions.ts",
      text: `"use server";
        function invalid(fieldErrors) { return err("Fix the fields.", fieldErrors); }
        export async function direct(input) { return err("Too long.", { note: ["Too long."] }); }
        export async function viaHelper(input) { if (!input) return invalid({}); return ok(1); }
        export async function messageOnly(input) { return err("Not found."); }
        export const arrow = async () => err("No.");`,
    };

    expect(namesFields(server, "direct")).toBe(true);
    expect(namesFields(server, "viaHelper")).toBe(true);
    expect(namesFields(server, "messageOnly")).toBe(false);
    expect(namesFields(server, "arrow")).toBe(false);
  });

  it("SCRUM-270 [AC1] TC-270-10: only named, non-type imports from a server module are actions", () => {
    const servers = new Map([[resolve("actions.ts"), { path: "actions.ts", text: '"use server";' }]]);
    const source: Source = {
      path: resolve("fixture.tsx"),
      text: `"use client";
        import { save, type Saved } from "./actions";
        import type { Other } from "./actions";
        import { helper } from "./helpers";
        import { aliased } from "@/actions";`,
    };

    expect(actionImports(source, servers).map(({ action }) => action)).toEqual([
      "save",
      "aliased",
    ]);
  });
});
