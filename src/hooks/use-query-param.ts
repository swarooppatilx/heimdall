"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface QueryParamOptions {
  deferCommit?: boolean;
}

export function useQueryParam(
  key: string,
  initial: string,
  opts?: QueryParamOptions,
): [string, (v: string) => void, (v: string) => void] {
  const router = useRouter();
  const [value, setValueState] = useState(initial);

  const commit = useCallback(
    (v: string) => {
      const params = new URLSearchParams(window.location.search);
      if ((params.get(key) ?? "") === v) return;
      if (v) {
        params.set(key, v);
      } else {
        params.delete(key);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [key, router],
  );

  const setValue = useCallback(
    (v: string) => {
      setValueState(v);
      if (!opts?.deferCommit) {
        commit(v);
      }
    },
    [commit, opts?.deferCommit],
  );

  useEffect(() => {
    const syncFromUrl = () =>
      setValueState(new URLSearchParams(window.location.search).get(key) ?? initial);
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [key, initial]);

  return [value, setValue, commit];
}
