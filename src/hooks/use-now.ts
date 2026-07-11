import { useEffect, useState } from 'react';

/** Current time, re-rendering every `intervalMs` — for "is this device
 * still online?" style derivations that must decay without new data. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
