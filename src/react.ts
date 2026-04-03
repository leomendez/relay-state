import { useSyncExternalStore } from "react";
import { get, subscribe } from "./index.ts";

export function useRelayState<T = unknown>(key: string, initialValue?: T): T | undefined {
  const value = useSyncExternalStore(
    (callback) => subscribe(key, callback),
    () => get<T>(key),
    () => get<T>(key),
  );
  return value === undefined ? initialValue : value;
}

export { clear, createStore, del, get, set, subscribe } from "./index.ts";
export type { RelayStore } from "./index.ts";
