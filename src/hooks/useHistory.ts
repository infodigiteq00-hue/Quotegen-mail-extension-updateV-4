import { useCallback, useState } from "react";

export function useHistory<T>(initial: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback((next: T, snapshot = true) => {
    if (snapshot) {
      setPast((p) => [...p.slice(-49), present]);
      setFuture([]);
    }
    setPresent(next);
  }, [present]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [present, ...f]);
      setPresent(prev);
      return p.slice(0, -1);
    });
  }, [present]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const [next, ...rest] = f;
      setPast((p) => [...p, present]);
      setPresent(next);
      return rest;
    });
  }, [present]);

  const reset = useCallback((next: T) => {
    setPast([]);
    setFuture([]);
    setPresent(next);
  }, []);

  return { state: present, set, undo, redo, reset, canUndo: past.length > 0, canRedo: future.length > 0 };
}
