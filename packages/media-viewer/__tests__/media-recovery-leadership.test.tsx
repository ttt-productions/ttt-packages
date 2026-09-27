import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useMediaRecovery } from "../src/react/use-media-recovery";
import type { MediaDiagnosticAdapter, DiagnosisResult } from "../src/recovery";

const URL_A = "https://cdn.example.com/shared.jpg";

function Viewer({
  id,
  url = URL_A,
  adapter,
  onRemount,
  isElementVisible,
}: {
  id: string;
  url?: string;
  adapter: MediaDiagnosticAdapter;
  onRemount?: () => void;
  isElementVisible?: boolean;
}) {
  const { recoveryState, onMediaError, onMediaLoad, manualRetry } = useMediaRecovery({
    url,
    adapter,
    onRemount,
    isElementVisible,
  });
  return (
    <div>
      <span data-testid={`${id}-phase`}>{recoveryState.phase}</span>
      <button type="button" data-testid={`${id}-error`} onClick={onMediaError}>
        error
      </button>
      <button type="button" data-testid={`${id}-load`} onClick={onMediaLoad}>
        load
      </button>
      <button type="button" data-testid={`${id}-retry`} onClick={manualRetry}>
        retry
      </button>
    </div>
  );
}

async function click(testId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
    await Promise.resolve();
  });
}

function transientAdapter() {
  const probe = vi.fn().mockResolvedValue({ kind: "transient" } satisfies DiagnosisResult);
  return { probe, adapter: { probe } as MediaDiagnosticAdapter };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useMediaRecovery leadership", () => {
  it("promotes a follower when the leader leaves, so the follower's next failure is probed", async () => {
    const { probe, adapter } = transientAdapter();
    function Pair({ showLeader }: { showLeader: boolean }) {
      return (
        <>
          {showLeader && <Viewer id="a" adapter={adapter} />}
          <Viewer id="b" adapter={adapter} />
        </>
      );
    }
    const { rerender } = render(<Pair showLeader />);
    await click("a-error");
    await click("b-error");
    expect(probe).toHaveBeenCalledTimes(1);

    // The leader unmounts, then a later failure of the follower's element is recovered.
    rerender(<Pair showLeader={false} />);
    await act(async () => {
      await Promise.resolve();
    });
    probe.mockClear();
    await click("b-error");

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("a promoted follower that is still failing drives the recovery at once", async () => {
    const { probe, adapter } = transientAdapter();
    function Pair({ showLeader }: { showLeader: boolean }) {
      return (
        <>
          {showLeader && <Viewer id="a" adapter={adapter} />}
          <Viewer id="b" adapter={adapter} />
        </>
      );
    }
    const { rerender } = render(<Pair showLeader />);
    await click("a-error");
    await click("b-error");
    probe.mockClear();

    await act(async () => {
      rerender(<Pair showLeader={false} />);
      await Promise.resolve();
    });

    expect(probe).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("b-phase").textContent).toBe("transient-retry");
  });

  it("the leader leaving through a URL change also promotes the follower", async () => {
    const { probe, adapter } = transientAdapter();
    function Pair({ leaderUrl }: { leaderUrl: string }) {
      return (
        <>
          <Viewer id="a" url={leaderUrl} adapter={adapter} />
          <Viewer id="b" adapter={adapter} />
        </>
      );
    }
    const { rerender } = render(<Pair leaderUrl={URL_A} />);
    await click("a-error");
    await click("b-error");
    probe.mockClear();

    await act(async () => {
      rerender(<Pair leaderUrl="https://cdn.example.com/other.jpg" />);
      await Promise.resolve();
    });

    expect(probe).toHaveBeenCalledWith(URL_A);
  });

  it("a failed follower retries its element when the leader reports the asset loaded", async () => {
    const { adapter } = transientAdapter();
    const followerRemount = vi.fn();
    render(
      <>
        <Viewer id="a" adapter={adapter} />
        <Viewer id="b" adapter={adapter} onRemount={followerRemount} />
      </>,
    );
    await click("a-error");
    await click("b-error");

    await click("a-load");

    expect(followerRemount).toHaveBeenCalled();
    expect(screen.getByTestId("b-phase").textContent).toBe("loaded");
  });

  it("a manual retry takes the lead, so its next failure is probed", async () => {
    const { probe, adapter } = transientAdapter();
    render(
      <>
        <Viewer id="a" adapter={adapter} />
        <Viewer id="b" adapter={adapter} />
      </>,
    );
    await click("a-error");
    await click("b-error");
    probe.mockClear();

    await click("b-retry");
    await click("b-error");

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("the last member leaving clears the URL, so a fresh failure leads again", async () => {
    const { probe, adapter } = transientAdapter();
    const { unmount } = render(<Viewer id="a" adapter={adapter} />);
    await click("a-error");
    unmount();

    probe.mockClear();
    render(<Viewer id="c" adapter={adapter} />);
    await click("c-error");

    expect(probe).toHaveBeenCalledTimes(1);
  });
});

describe("useMediaRecovery visibility", () => {
  it("creates no IntersectionObserver of its own", () => {
    const constructed = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor() {
          constructed();
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    render(<Viewer id="a" adapter={transientAdapter().adapter} />);
    expect(constructed).not.toHaveBeenCalled();
  });

  it("a scheduled retry waits while the viewer reports its element off screen", async () => {
    const { adapter } = transientAdapter();
    const remount = vi.fn();
    const { rerender } = render(
      <Viewer id="a" url="https://cdn.example.com/solo.jpg" adapter={adapter} onRemount={remount} isElementVisible />,
    );
    await click("a-error");
    expect(screen.getByTestId("a-phase").textContent).toBe("transient-retry");

    rerender(
      <Viewer id="a" url="https://cdn.example.com/solo.jpg" adapter={adapter} onRemount={remount} isElementVisible={false} />,
    );
    act(() => vi.advanceTimersByTime(40_000));
    expect(remount).not.toHaveBeenCalled();

    rerender(
      <Viewer id="a" url="https://cdn.example.com/solo.jpg" adapter={adapter} onRemount={remount} isElementVisible />,
    );
    act(() => vi.advanceTimersByTime(40_000));
    expect(remount).toHaveBeenCalled();
  });
});
