import { useCallback, useRef, useSyncExternalStore } from "react";
import { get, set, subscribe } from "./index.ts";

/** A setter that accepts either a direct value or an updater function. */
export type Setter<T> = (value: T | ((prev: T | undefined) => T)) => void;

/**
 * Subscribes to a key and returns the current value. Re-renders when the value changes.
 *
 * If `initialValue` is provided and the key is currently unset, the value is written to the
 * store on first mount so all consumers see the same default.
 *
 * Use this when a component needs to read state but never write it.
 */
export function useRelayStateValue<T = unknown>(key: string, initialValue?: T): T | undefined {
  const initKeyRef = useRef<string | null>(null);
  if (initKeyRef.current !== key) {
    initKeyRef.current = key;
    if (initialValue !== undefined && get(key) === undefined) {
      set(key, initialValue);
    }
  }
  const value = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => get<T>(key),
    () => get<T>(key),
  );
  return value === undefined ? initialValue : value;
}

/**
 * Returns a stable setter for a key. The component does **not** re-render when the value
 * changes — the key performance primitive for write-only components.
 */
export function useSetRelayState<T = unknown>(key: string): Setter<T> {
  return useCallback((value: T | ((prev: T | undefined) => T)) => set<T>(key, value), [key]);
}

/**
 * Returns a `[value, setter]` tuple — the same pattern as React's `useState`, but shared
 * across micro frontends. Re-renders when the value changes.
 *
 * If `initialValue` is provided and the key is currently unset, the value is written to the
 * store on first mount so all consumers see the same default.
 */
export function useRelayState<T = unknown>(
  key: string,
  initialValue?: T,
): [T | undefined, Setter<T>] {
  return [useRelayStateValue<T>(key, initialValue), useSetRelayState<T>(key)];
}

export { clear, createStore, del, get, set, subscribe } from "./index.ts";
export type { RelayStore } from "./index.ts";
