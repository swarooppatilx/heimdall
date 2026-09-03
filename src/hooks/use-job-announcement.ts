import { useEffect, useState } from "react";

const ANNOUNCEMENT_DEBOUNCE_MS = 600;

export function useJobAnnouncement(
  isLoading: boolean,
  isError: boolean,
  countLabel: string,
): string {
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnnouncement(isLoading ? "" : isError ? "fetching failed" : countLabel);
    }, ANNOUNCEMENT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [countLabel, isLoading, isError]);
  return announcement;
}
