import { describe, expect, it } from "vitest";
import { playerKeyAction } from "@/components/StepPlayer";

const key = (k: string, mods: Partial<Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>> = {}) =>
  ({ key: k, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

/** A tiny stand-in for a DOM element: tag name plus the selectors closest() should match. */
const el = (tag: string, matches: string[]) =>
  ({ tagName: tag, closest: (sel: string) => (sel.split(",").some((s) => matches.includes(s.trim())) ? {} : null) }) as unknown as Element;

describe("playerKeyAction", () => {
  const inPlayer = el("DIV", ["[data-player]"]);
  const button = el("BUTTON", ["[data-player]", "button"]);

  it("arrows step, Space toggles when focus is on the player itself", () => {
    expect(playerKeyAction(key("ArrowRight"), inPlayer)).toBe("next");
    expect(playerKeyAction(key("ArrowLeft"), inPlayer)).toBe("prev");
    expect(playerKeyAction(key(" "), inPlayer)).toBe("toggle");
  });

  it("leaves Space to a focused button so Previous/Next/step-list buttons still activate", () => {
    expect(playerKeyAction(key(" "), button)).toBeNull();
  });

  it("ignores browser shortcuts such as Alt+Left (Back) and Ctrl+Right", () => {
    expect(playerKeyAction(key("ArrowLeft", { altKey: true }), inPlayer)).toBeNull();
    expect(playerKeyAction(key("ArrowRight", { ctrlKey: true }), inPlayer)).toBeNull();
    expect(playerKeyAction(key("ArrowRight", { metaKey: true }), inPlayer)).toBeNull();
  });

  it("does not take keys from form fields, nor arrows from a zoomed drawing", () => {
    expect(playerKeyAction(key("ArrowRight"), el("INPUT", ["[data-player]"]))).toBeNull();
    expect(playerKeyAction(key(" "), el("SELECT", ["[data-player]"]))).toBeNull();
    const board = el("DIV", ["[data-player]", "[data-board]"]);
    expect(playerKeyAction(key("ArrowRight"), board, true)).toBeNull();
    expect(playerKeyAction(key("ArrowRight"), board, false)).toBe("next");
  });
});
