const cache = new Map<string, unknown>();
const EVENT_PREFIX = "relay-state:";

function dispatch(key: string, value: unknown): void {
  window.dispatchEvent(new CustomEvent(`${EVENT_PREFIX}${key}`, { detail: { value } }));
}

export function get<T = unknown>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function set<T = unknown>(key: string, value: T | ((prev: T | undefined) => T)): void {
  const resolved =
    typeof value === "function"
      ? (value as (prev: T | undefined) => T)(cache.get(key) as T | undefined)
      : value;
  cache.set(key, resolved);
  dispatch(key, resolved);
}

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

export function del(key: string): void {
  cache.delete(key);
  dispatch(key, undefined);
}

export function clear(): void {
  for (const key of cache.keys()) {
    dispatch(key, undefined);
  }
  cache.clear();
}

export interface RelayStore {
  get: <T = unknown>(key: string) => T | undefined;
  set: <T = unknown>(key: string, value: T | ((prev: T | undefined) => T)) => void;
  subscribe: <T = unknown>(key: string, callback: (value: T | undefined) => void) => () => void;
  del: (key: string) => void;
  clear: () => void;
}

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
