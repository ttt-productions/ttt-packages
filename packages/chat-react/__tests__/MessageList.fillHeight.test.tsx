import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MessageList } from "../src/ui/MessageList.js";

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
