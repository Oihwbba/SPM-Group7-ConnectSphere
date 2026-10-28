import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Dialog } from "@/components/ui/dialog";
import {
  ConfirmDialog,
  ConfirmDialogBody,
  runConfirmed,
} from "@/components/app/confirm-dialog";

const wording = {
  title: "Withdraw from this event?",
  message: "Your place is released for someone else.",
  confirmLabel: "Withdraw",
  pendingLabel: "Withdrawing…",
  cancelLabel: "Keep my place",
};

// The body needs the dialog's context for its title, as it has in the app.
function body(props: Partial<Parameters<typeof ConfirmDialogBody>[0]> = {}) {
  return renderToStaticMarkup(
    <Dialog open>
      <ConfirmDialogBody
        {...wording}
        pending={false}
        error={null}
        onConfirm={() => {}}
        onCancel={() => {}}
        {...props}
      />
    </Dialog>,
  );
}

const button = (html: string, testId: string) =>
  html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>([^<]*)<`));

describe("SCRUM-207 — the shared confirmation dialog", () => {
  it("SCRUM-207 [AC5] TC-207-10: asks with the action's title, message, a way back and a confirm button", () => {
    const html = body();
    expect(html).toContain("Withdraw from this event?");
    expect(html).toContain("Your place is released for someone else.");
    expect(button(html, "confirm-dialog-cancel")?.[1]).toBe("Keep my place");
    expect(button(html, "confirm-dialog-confirm")?.[1]).toBe("Withdraw");
    expect(html).not.toContain('data-testid="confirm-dialog-error"');
  });

  it("SCRUM-207 [AC5] TC-207-10: the way back is called Cancel unless the action names it", () => {
    const { cancelLabel: _, ...withoutCancel } = wording;
    const html = renderToStaticMarkup(
      <Dialog open>
        <ConfirmDialogBody
          {...withoutCancel}
          pending={false}
          error={null}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </Dialog>,
    );
    expect(button(html, "confirm-dialog-cancel")?.[1]).toBe("Cancel");
  });

  it("SCRUM-207 [AC5] TC-207-10: a destructive action's confirm button is red, any other's is not", () => {
    expect(
      button(body({ destructive: true }), "confirm-dialog-confirm")?.[0],
    ).toContain("bg-destructive");
    expect(button(body(), "confirm-dialog-confirm")?.[0]).not.toContain(
      "bg-destructive",
    );
  });

  it("SCRUM-207 [AC5] TC-207-10: while the action runs, both buttons are disabled and the confirm button says what is happening", () => {
    const html = body({ pending: true });
    expect(button(html, "confirm-dialog-confirm")?.[0]).toContain(
      'disabled=""',
    );
    expect(button(html, "confirm-dialog-cancel")?.[0]).toContain('disabled=""');
    expect(button(html, "confirm-dialog-confirm")?.[1]).toBe("Withdrawing…");
    expect(button(body(), "confirm-dialog-confirm")?.[0]).not.toContain(
      'disabled=""',
    );
  });

  it("SCRUM-207 [AC5] TC-207-10: a refusal is shown inside the dialog, as an alert", () => {
    expect(
      body({ error: "You can't withdraw once the event has started." }),
    ).toMatch(
      /role="alert"[^>]*data-testid="confirm-dialog-error"[^>]*>You can&#x27;t withdraw once the event has started\.</,
    );
  });

  it("SCRUM-207 [AC5] TC-207-10: a refused action keeps the dialog open with its message", async () => {
    const close = vi.fn();
    const fail = vi.fn();
    await runConfirmed(
      async () => ({ ok: false, error: "Registration not found." }),
      { close, fail },
    );
    expect(fail).toHaveBeenCalledWith("Registration not found.");
    expect(close).not.toHaveBeenCalled();
  });

  it("SCRUM-207 [AC5] TC-207-10: an action that succeeds closes the dialog", async () => {
    const close = vi.fn();
    const fail = vi.fn();
    await runConfirmed(async () => ({ ok: true }), { close, fail });
    expect(close).toHaveBeenCalledOnce();
    expect(fail).not.toHaveBeenCalled();
  });

  it("SCRUM-207 [AC5] TC-207-10: until it is opened, only the trigger shows and the action does not run", () => {
    const action = vi.fn(async () => ({ ok: true as const }));
    const html = renderToStaticMarkup(
      <ConfirmDialog
        {...wording}
        trigger={<button type="button">Withdraw</button>}
        onConfirm={action}
      />,
    );
    expect(html).toContain(">Withdraw</button>");
    expect(html).not.toContain("Withdraw from this event?");
    expect(action).not.toHaveBeenCalled();
  });
});
