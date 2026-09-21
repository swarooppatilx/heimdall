import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Radix restores focus to a popup's trigger on close, and the browser scrolls
// to it. After a long scroll that throws away the reader's place, so focus is
// returned by hand without scrolling.
export function refocusWithoutScroll(target: React.RefObject<HTMLElement | null>) {
  return (event: Event) => {
    event.preventDefault();
    target.current?.focus({ preventScroll: true });
  };
}
