const cache = new Map<string, unknown>();
const EVENT_PREFIX = "relay-state:";

function dispatch(key: string, value: unknown): void {
  window.dispatchEvent(new CustomEvent(`${EVENT_PREFIX}${key}`, { detail: { value } }));
}

/** Returns the current value for a key, or `undefined` if the key has not been set. */
export function get<T = unknown>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

/**
 * Sets a value in the store and dispatches a `CustomEvent` on `window` to notify all subscribers.
 * Accepts either a direct value or an updater function that receives the previous value.
 *
 * **Note:** Because updater functions are detected via `typeof value === "function"`, storing a
 * function as a value requires wrapping it: `set("cb", () => myFunction)`.
 */
export function set<T = unknown>(key: string, value: T | ((prev: T | undefined) => T)): void {
  const resolved =
    typeof value === "function"
      ? (value as (prev: T | undefined) => T)(cache.get(key) as T | undefined)
      : value;
  cache.set(key, resolved);
  dispatch(key, resolved);
}

/**
 * Subscribes to changes for a key. The callback fires whenever `set` or `del` is called for
 * that key, including updates originating from other micro frontend bundles. Returns an
 * unsubscribe function.
 *
 * The signature is compatible with React's `useSyncExternalStore`.
 */
export function subscribe<T = unknown>(
  key: string,
  callback: (value: T | undefined) => void,
): () => void {
  const listener = (event: Event) => {
    const val = (event as CustomEvent).detail.value as T | undefined;
    if (val === undefined) {
      cache.delete(key);
    } else {
      cache.set(key, val);
    }
    callback(val);
  };
  window.addEventListener(`${EVENT_PREFIX}${key}`, listener);
  return () => {
    window.removeEventListener(`${EVENT_PREFIX}${key}`, listener);
  };
}

/** Deletes a key from the store and notifies subscribers with `undefined`. */
export function del(key: string): void {
  cache.delete(key);
  dispatch(key, undefined);
}

/**
 * Removes all keys from the store and notifies all active subscribers with `undefined`.
 * Useful for logout flows or full application resets.
 */
export function clear(): void {
  for (const key of cache.keys()) {
    dispatch(key, undefined);
  }
  cache.clear();
}

/** The interface returned by `createStore`. */
export interface RelayStore {
  get: <T = unknown>(key: string) => T | undefined;
  set: <T = unknown>(key: string, value: T | ((prev: T | undefined) => T)) => void;
  subscribe: <T = unknown>(key: string, callback: (value: T | undefined) => void) => () => void;
  del: (key: string) => void;
  /** Removes all keys in this namespace and notifies their subscribers with `undefined`. */
  clear: () => void;
}

/**
 * Creates a namespaced store. All keys are prefixed with `namespace:` internally, preventing
 * collisions between micro frontends while sharing the same underlying cache and event bus.
 *
 * @example
 * const appA = createStore("appA");
 * appA.set("user", { name: "Leo" }); // stored as "appA:user"
 */
export function createStore(namespace: string): RelayStore {
  const prefix = (key: string) => `${namespace}:${key}`;
  return {
    get: <T = unknown>(key: string) => get<T>(prefix(key)),
    set: <T = unknown>(key: string, value: T | ((prev: T | undefined) => T)) =>
      set<T>(prefix(key), value),
    subscribe: <T = unknown>(key: string, callback: (value: T | undefined) => void) =>
      subscribe<T>(prefix(key), callback),
    del: (key: string) => del(prefix(key)),
    clear: () => {
      for (const key of cache.keys()) {
        if (key.startsWith(`${namespace}:`)) {
          del(key);
        }
      }
    },
  };
}
