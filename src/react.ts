import { useCallback, useSyncExternalStore } from "react";
import { get, set, subscribe } from "./index.ts";

export type Setter<T> = (value: T | ((prev: T | undefined) => T)) => void;

export function useRelayStateValue<T = unknown>(key: string, initialValue?: T): T | undefined {
  const value = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => get<T>(key),
    () => get<T>(key),
  );
  return value === undefined ? initialValue : value;
}

export function useSetRelayState<T = unknown>(key: string): Setter<T> {
  return useCallback((value: T | ((prev: T | undefined) => T)) => set<T>(key, value), [key]);
}

export function useRelayState<T = unknown>(
  key: string,
  initialValue?: T,
): [T | undefined, Setter<T>] {
  return [useRelayStateValue<T>(key, initialValue), useSetRelayState<T>(key)];
}

export { clear, createStore, del, get, set, subscribe } from "./index.ts";
export type { RelayStore } from "./index.ts";
