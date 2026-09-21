import { describe, expect, it, vi } from "vitest";
import { refocusWithoutScroll } from "@/lib/utils";

describe("refocusWithoutScroll", () => {
  it("returns focus to the trigger without scrolling the page to it", () => {
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const handler = refocusWithoutScroll({ current: { focus } as unknown as HTMLElement });

    handler({ preventDefault } as unknown as Event);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("does nothing beyond cancelling the default when the trigger is gone", () => {
    const preventDefault = vi.fn();

    refocusWithoutScroll({ current: null })({ preventDefault } as unknown as Event);

    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
