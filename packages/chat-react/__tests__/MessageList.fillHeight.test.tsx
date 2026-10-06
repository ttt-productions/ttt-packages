import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { MessageList, type ChatScrollContainerProps } from "../src/ui/MessageList.js";

// The scrollable region is the element carrying `overflow-y-auto`.
function scrollRegion(container: HTMLElement): HTMLElement {
  const el = container.querySelector(".overflow-y-auto");
  if (!el) throw new Error("scroll region not found");
  return el as HTMLElement;
}

describe("MessageList — height modes", () => {
  it("defaults to a fixed-height scroll region (h-[400px])", () => {
    const { container } = render(
      <MessageList messages={[]} currentUserId="u1" isAdmin={false} />,
    );
    expect(scrollRegion(container).className).toContain("h-[400px]");
    // Outer wrapper is not a flex-fill container in the default mode.
    expect(container.firstElementChild?.className).toBe("relative");
  });

  it("fillHeight makes the list flex to fill its parent (flex-1 min-h-0)", () => {
    const { container } = render(
      <MessageList messages={[]} currentUserId="u1" isAdmin={false} fillHeight />,
    );
    const scroll = scrollRegion(container);
    expect(scroll.className).toContain("flex-1");
    expect(scroll.className).toContain("min-h-0");
    expect(scroll.className).not.toContain("h-[400px]");
    // Outer wrapper becomes a bounded flex-col so the scroll child can flex.
    expect(container.firstElementChild?.className).toContain("flex flex-col");
    expect(container.firstElementChild?.className).toContain("min-h-0");
  });

  it("an explicit scrollClassName overrides both defaults", () => {
    const { container } = render(
      <MessageList messages={[]} currentUserId="u1" isAdmin={false} scrollClassName="h-[600px]" />,
    );
    expect(scrollRegion(container).className).toContain("h-[600px]");
    expect(scrollRegion(container).className).not.toContain("h-[400px]");
  });
});

describe("MessageList — a custom scroll container", () => {
  function Surface({ ref, className, onScroll, children }: ChatScrollContainerProps) {
    return (
      <section ref={ref as React.Ref<HTMLElement>} data-surface="paper" className={className} onScroll={onScroll}>
        {children}
      </section>
    );
  }

  it("renders the scrollable region through the consumer's component, with the list's class and content", () => {
    const { container, getByText } = render(
      <MessageList messages={[]} currentUserId="u1" isAdmin={false} scrollClassName="h-[600px]" scrollContainer={Surface} />,
    );
    const region = scrollRegion(container);
    expect(region.tagName).toBe("SECTION");
    expect(region).toHaveAttribute("data-surface", "paper");
    expect(region.className).toContain("h-[600px]");
    expect(region).toContainElement(getByText("No messages yet"));
  });

  it("hands the container the list's ref, so the list still drives its scroll position", () => {
    const { container } = render(
      <MessageList messages={[]} currentUserId="u1" isAdmin={false} scrollContainer={Surface} showScrollToBottom />,
    );
    const region = scrollRegion(container);
    Object.defineProperty(region, "scrollHeight", { configurable: true, value: 900 });
    region.scrollTop = 0;
    fireEvent.click(screen.getByRole("button", { name: "Scroll to latest" }));
    expect(region.scrollTop).toBe(900);
  });
});

describe("MessageList — a failed older page", () => {
  it("renders the failure row and stops asking for older pages, however often the top comes into view", () => {
    let fire: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
    class FakeObserver {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
    }
    const original = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
    try {
      const onLoadOlder = vi.fn();
      const { getByText, rerender } = render(
        <MessageList messages={[]} currentUserId="u1" isAdmin={false} hasOlder onLoadOlder={onLoadOlder} />,
      );
      fire!([{ isIntersecting: true }]);
      expect(onLoadOlder).toHaveBeenCalledTimes(1);

      rerender(
        <MessageList
          messages={[]}
          currentUserId="u1"
          isAdmin={false}
          hasOlder
          onLoadOlder={onLoadOlder}
          olderLoadErrorRow={<div>older page failed</div>}
        />,
      );
      expect(getByText("older page failed")).toBeTruthy();
      fire!([{ isIntersecting: true }]);
      fire!([{ isIntersecting: true }]);
      expect(onLoadOlder).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.IntersectionObserver = original;
    }
  });
});
