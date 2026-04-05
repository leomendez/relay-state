// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { clear, createStore, del, DELETED, get, has, set, subscribe } from "../src/index.ts";

beforeEach(() => {
  clear();
});

describe("CRUD", () => {
  test("set then get returns the value", () => {
    set("key", "value");
    expect(get("key")).toBe("value");
  });

  test("get on non-existent key returns undefined", () => {
    expect(get("missing")).toBeUndefined();
  });

  test("set overwrites an existing value", () => {
    set("key", "first");
    set("key", "second");
    expect(get("key")).toBe("second");
  });

  test("del removes a key", () => {
    set("key", "value");
    del("key");
    expect(get("key")).toBeUndefined();
  });

  test("has returns true for existing key", () => {
    set("key", "value");
    expect(has("key")).toBe(true);
  });

  test("has returns false for non-existent key", () => {
    expect(has("missing")).toBe(false);
  });

  test("has returns true when value is undefined", () => {
    set("key", undefined);
    expect(has("key")).toBe(true);
  });

  test("has returns false after del", () => {
    set("key", "value");
    del("key");
    expect(has("key")).toBe(false);
  });

  test("clear empties all state", () => {
    set("a", 1);
    set("b", 2);
    clear();
    expect(get("a")).toBeUndefined();
    expect(get("b")).toBeUndefined();
  });

  test("clear dispatches events for all active keys", () => {
    const cbA = vi.fn();
    const cbB = vi.fn();
    set("a", 1);
    set("b", 2);
    subscribe("a", cbA);
    subscribe("b", cbB);
    // Replay fires once per subscriber, then clear fires once per subscriber
    clear();
    expect(cbA).toHaveBeenLastCalledWith(undefined);
    expect(cbB).toHaveBeenLastCalledWith(undefined);
    expect(cbA).toHaveBeenCalledTimes(2);
    expect(cbB).toHaveBeenCalledTimes(2);
  });
});

describe("updater functions", () => {
  test("set with updater when key exists", () => {
    set<number>("count", 5);
    set<number>("count", (prev) => (prev ?? 0) + 1);
    expect(get("count")).toBe(6);
  });

  test("set with updater when key does not exist", () => {
    set<number>("count", (prev) => (prev ?? 0) + 1);
    expect(get("count")).toBe(1);
  });
});

describe("subscriptions", () => {
  test("callback fires on set", () => {
    const cb = vi.fn();
    subscribe("key", cb);
    set("key", "hello");
    expect(cb).toHaveBeenCalledWith("hello");
  });

  test("callback fires on del with undefined", () => {
    set("key", "value");
    const cb = vi.fn();
    subscribe("key", cb);
    // cb fires once from replay with "value", then once from del with undefined
    del("key");
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(undefined);
  });

  test("unsubscribe stops callback from firing", () => {
    const cb = vi.fn();
    const unsub = subscribe("key", cb);
    unsub();
    set("key", "value");
    expect(cb).not.toHaveBeenCalled();
  });

  test("multiple subscribers on same key all fire", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribe("key", cb1);
    subscribe("key", cb2);
    set("key", "value");
    expect(cb1).toHaveBeenCalledWith("value");
    expect(cb2).toHaveBeenCalledWith("value");
    // Each subscriber fires once (no replay since key was unset when subscribing)
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  test("subscriber on key a does not fire when key b changes", () => {
    const cb = vi.fn();
    subscribe("a", cb);
    set("b", "value");
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("CustomEvent integration", () => {
  test("set dispatches CustomEvent with correct name and detail", () => {
    const cb = vi.fn();
    window.addEventListener("relay-state:key", cb);
    set("key", "value");
    expect(cb).toHaveBeenCalledTimes(1);
    const event = cb.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ value: "value" });
    window.removeEventListener("relay-state:key", cb);
  });

  test("del dispatches CustomEvent with DELETED sentinel", () => {
    const cb = vi.fn();
    window.addEventListener("relay-state:key", cb);
    set("key", "value");
    del("key");
    const event = cb.mock.calls[1][0] as CustomEvent;
    expect(event.detail).toEqual({ value: DELETED });
    window.removeEventListener("relay-state:key", cb);
  });

  test("external CustomEvent triggers subscribers", () => {
    const cb = vi.fn();
    subscribe("ext", cb);
    window.dispatchEvent(new CustomEvent("relay-state:ext", { detail: { value: "external" } }));
    expect(cb).toHaveBeenCalledWith("external");
  });

  test("external CustomEvent updates the cache", () => {
    subscribe("ext", () => {});
    window.dispatchEvent(new CustomEvent("relay-state:ext", { detail: { value: "synced" } }));
    expect(get("ext")).toBe("synced");
  });

  test("external CustomEvent with undefined stores undefined (does not delete)", () => {
    set("ext", "value");
    subscribe("ext", () => {});
    window.dispatchEvent(new CustomEvent("relay-state:ext", { detail: { value: undefined } }));
    expect(get("ext")).toBeUndefined();
  });

  test("external CustomEvent with DELETED sentinel deletes from cache", () => {
    set("ext", "value");
    subscribe("ext", () => {});
    window.dispatchEvent(new CustomEvent("relay-state:ext", { detail: { value: DELETED } }));
    expect(get("ext")).toBeUndefined();
  });
});

describe("namespaces", () => {
  test("namespaced set is retrievable via global get with prefix", () => {
    const store = createStore("appA");
    store.set("user", { name: "Leo" });
    expect(get("appA:user")).toEqual({ name: "Leo" });
  });

  test("namespaced get reads from prefixed key", () => {
    set("appA:user", { name: "Leo" });
    const store = createStore("appA");
    expect(store.get("user")).toEqual({ name: "Leo" });
  });

  test("namespaced subscribe fires on global set with prefix", () => {
    const store = createStore("appA");
    const cb = vi.fn();
    store.subscribe("user", cb);
    set("appA:user", "updated");
    // No replay (key unset when subscribing), fires once from set
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("updated");
  });

  test("two namespaced stores with same key do not collide", () => {
    const storeA = createStore("appA");
    const storeB = createStore("appB");
    storeA.set("count", 1);
    storeB.set("count", 2);
    expect(storeA.get("count")).toBe(1);
    expect(storeB.get("count")).toBe(2);
  });

  test("namespaced has checks prefixed key", () => {
    const store = createStore("appA");
    store.set("key", "value");
    expect(store.has("key")).toBe(true);
    expect(store.has("missing")).toBe(false);
  });

  test("namespaced del removes the prefixed key", () => {
    const store = createStore("appA");
    store.set("key", "value");
    store.del("key");
    expect(get("appA:key")).toBeUndefined();
  });

  test("namespaced clear removes only keys with that prefix", () => {
    const storeA = createStore("appA");
    const storeB = createStore("appB");
    storeA.set("x", 1);
    storeA.set("y", 2);
    storeB.set("x", 3);
    storeA.clear();
    expect(get("appA:x")).toBeUndefined();
    expect(get("appA:y")).toBeUndefined();
    expect(get("appB:x")).toBe(3);
  });

  test("namespaced clear dispatches events for removed keys", () => {
    const store = createStore("appA");
    store.set("key", "value");
    const cb = vi.fn();
    store.subscribe("key", cb);
    // Replay fires with "value", then clear fires with undefined
    store.clear();
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(undefined);
  });
});

describe("useSyncExternalStore compatibility", () => {
  test("subscribe returns an unsubscribe function", () => {
    const unsub = subscribe("key", () => {});
    expect(typeof unsub).toBe("function");
  });

  test("set triggers callback synchronously", () => {
    const values: unknown[] = [];
    subscribe("key", (v) => values.push(v));
    set("key", "a");
    set("key", "b");
    expect(values).toEqual(["a", "b"]);
  });

  test("get returns same reference for unchanged objects", () => {
    const obj = { x: 1 };
    set("ref", obj);
    expect(get("ref")).toBe(obj);
    expect(get("ref")).toBe(obj);
  });
});

describe("equality check (Object.is)", () => {
  test("setting the same primitive twice fires subscriber once", () => {
    const cb = vi.fn();
    subscribe("key", cb);
    set("key", "same");
    set("key", "same");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("NaN equals NaN — subscriber fires once", () => {
    const cb = vi.fn();
    subscribe("key", cb);
    set("key", NaN);
    set("key", NaN);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("0 and -0 are not equal — subscriber fires twice", () => {
    const cb = vi.fn();
    subscribe("key", cb);
    set("key", 0);
    set("key", -0);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  test("same object reference twice fires subscriber once", () => {
    const obj = { x: 1 };
    const cb = vi.fn();
    subscribe("key", cb);
    set("key", obj);
    set("key", obj);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("undefined as a value", () => {
  test("set(key, undefined) stores undefined without deleting", () => {
    set("key", undefined);
    // get returns undefined, but the key exists in the store
    expect(get("key")).toBeUndefined();
    // Subscribing replays the value, proving the key is present
    const cb = vi.fn();
    subscribe("key", cb);
    expect(cb).toHaveBeenCalledWith(undefined);
  });

  test("del removes a key that was set to undefined", () => {
    set("key", undefined);
    del("key");
    // After del, subscribing should NOT replay (key is gone)
    const cb = vi.fn();
    subscribe("key", cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test("subscriber receives undefined from set and from del", () => {
    const cb = vi.fn();
    subscribe("key", cb);
    set("key", undefined);
    expect(cb).toHaveBeenCalledWith(undefined);
    del("key");
    // Second call: del also delivers undefined via the DELETED sentinel
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(undefined);
  });
});

describe("replay on subscribe", () => {
  test("subscriber receives current value immediately when key exists", () => {
    set("key", "hello");
    const cb = vi.fn();
    subscribe("key", cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("hello");
  });

  test("subscriber does not fire immediately when key is unset", () => {
    const cb = vi.fn();
    subscribe("missing", cb);
    expect(cb).not.toHaveBeenCalled();
  });

  test("subscriber replays undefined when key was set to undefined", () => {
    set("key", undefined);
    const cb = vi.fn();
    subscribe("key", cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(undefined);
  });
});

describe("debug mode", () => {
  test("window.__RELAY_STATE__ is exposed in dev mode", () => {
    // Vitest runs with import.meta.env.DEV = true
    expect((window as any).__RELAY_STATE__).toBeDefined();
    expect((window as any).__RELAY_STATE__.cache).toBeInstanceOf(Map);
  });

  test("exposed cache reflects live state", () => {
    const liveCache = (window as any).__RELAY_STATE__.cache as Map<string, unknown>;
    set("debug-key", "value");
    expect(liveCache.get("debug-key")).toBe("value");
    del("debug-key");
    expect(liveCache.has("debug-key")).toBe(false);
  });
});
