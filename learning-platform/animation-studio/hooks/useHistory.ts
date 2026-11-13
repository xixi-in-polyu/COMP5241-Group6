import { useCallback, useState } from 'react';

export function useHistory<T>(initialValue: T) {
  const [present, setPresent] = useState<T>(initialValue);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const commit = useCallback((next: T | ((current: T) => T)) => {
    setPresent((current) => {
      const value = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
      if (Object.is(value, current)) return current;
      setPast((items) => [...items.slice(-49), current]);
      setFuture([]);
      return value;
    });
  }, []);

  const replace = useCallback((value: T) => {
    setPresent(value);
    setPast([]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setPresent((current) => {
        setFuture((nextItems) => [current, ...nextItems]);
        return previous;
      });
      return items.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((items) => {
      if (!items.length) return items;
      const next = items[0];
      setPresent((current) => {
        setPast((previousItems) => [...previousItems, current]);
        return next;
      });
      return items.slice(1);
    });
  }, []);

  return { present, commit, replace, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
