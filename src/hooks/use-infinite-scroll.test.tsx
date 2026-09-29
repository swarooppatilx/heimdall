// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

let observers: { callback: IntersectionObserverCallback; disconnect: () => void }[] = [];

class FakeIntersectionObserver {
  readonly disconnect = vi.fn();
  constructor(readonly callback: IntersectionObserverCallback) {
    observers.push(this);
  }
  observe() {}
}

function Sentinel({ loadMore, enabled }: { loadMore: () => void; enabled: boolean }) {
  const ref = useInfiniteScroll(loadMore, enabled);
  return <div ref={ref} />;
}

function intersect() {
  for (const { callback } of observers) {
    callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  }
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

describe("useInfiniteScroll", () => {
  it("loads more when the sentinel nears the viewport", () => {
    const loadMore = vi.fn();
    render(<Sentinel loadMore={loadMore} enabled />);

    intersect();

    expect(loadMore).toHaveBeenCalledOnce();
  });

  it("stops watching while disabled, so a failed page isn't retried in a loop", () => {
    const loadMore = vi.fn();
    const { rerender } = render(<Sentinel loadMore={loadMore} enabled />);

    rerender(<Sentinel loadMore={loadMore} enabled={false} />);
    observers.splice(0);
    intersect();

    expect(loadMore).not.toHaveBeenCalled();
  });
});
