import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

// The Composer's additive `openAttachmentSelector()` handle must delegate straight
// to the underlying MediaInput's `openSelection()` (the canonical picker seam) and
// pass the composer's disabled/loading state down so MediaInput's own gate no-ops a
// disabled composer.

const openSelectionSpy = vi.fn();
let lastMediaInputProps: { disabled?: boolean; isLoading?: boolean } = {};

vi.mock("@ttt-productions/upload-ui/react/upload", () => ({
  useGuardedUpload: () => vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@ttt-productions/upload-ui/react/guard", () => ({
  useOptionalLocalUploadGuard: () => null,
}));
vi.mock("@ttt-productions/file-input", () => ({
  ensureFileWithContentType: (f: File) => f,
}));
vi.mock("@ttt-productions/file-input/react", () => ({
  MediaInput: React.forwardRef(function MediaInput(
    props: { disabled?: boolean; isLoading?: boolean },
    ref: React.Ref<{ openSelection: () => void }>,
  ) {
    lastMediaInputProps = props;
    React.useImperativeHandle(ref, () => ({ openSelection: openSelectionSpy }), []);
    return <div data-testid="media-input" />;
  }),
}));
vi.mock("../src/mentions/use-mention-autocomplete.js", () => ({
  useMentionAutocomplete: () => ({
    state: { open: false },
    getValueWithTokens: () => "",
    close: vi.fn(),
    insertMention: vi.fn(),
    handleKeyDown: () => false,
  }),
}));
vi.mock("../src/mentions/MentionAutocomplete.js", () => ({
  MentionAutocomplete: () => null,
}));

import { Composer } from "../src/ui/Composer.js";
import type { ComposerHandle } from "../src/ui/Composer.js";

function makeAttachmentConfig() {
  return {
    storage: {} as never,
    userId: "user1",
    uploadAdapter: { buildUploadPath: () => "uploads/chat-attachment/user1/x" },
    attachmentSpec: {} as never,
  } as never;
}

beforeEach(() => {
  openSelectionSpy.mockClear();
  lastMediaInputProps = {};
});

describe("Composer.openAttachmentSelector", () => {
  it("delegates to MediaInput.openSelection exactly once", () => {
    const ref = React.createRef<ComposerHandle>();
    render(
      <Composer
        ref={ref}
        onSend={vi.fn().mockResolvedValue(undefined)}
        attachmentConfig={makeAttachmentConfig()}
        sendAttachment={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    act(() => {
      ref.current!.openAttachmentSelector();
    });
    expect(openSelectionSpy).toHaveBeenCalledTimes(1);
  });

  it("passes the disabled state to MediaInput so its openSelection gate no-ops a disabled composer", () => {
    const ref = React.createRef<ComposerHandle>();
    render(
      <Composer
        ref={ref}
        disabled
        onSend={vi.fn().mockResolvedValue(undefined)}
        attachmentConfig={makeAttachmentConfig()}
        sendAttachment={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(lastMediaInputProps.disabled).toBe(true);
  });

  it("is a safe no-op when attachments are not configured (MediaInput is not mounted)", () => {
    const ref = React.createRef<ComposerHandle>();
    render(<Composer ref={ref} onSend={vi.fn().mockResolvedValue(undefined)} />);
    expect(() =>
      act(() => {
        ref.current!.openAttachmentSelector();
      }),
    ).not.toThrow();
    expect(openSelectionSpy).not.toHaveBeenCalled();
  });
});
