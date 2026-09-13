"use client";

import { useEffect, useState } from "react";

/**
 * The current time, read after mount and refreshed every minute. Null during
 * server render and the first client frame, so "Today" / "Overdue" markers
 * never mismatch between server and client.
 */
export function useNow(refreshMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, refreshMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [refreshMs]);

  return now;
}
