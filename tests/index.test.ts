// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { clear, createStore, del, get, set, subscribe } from "../src/index.ts";

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

  test("clear empties all state", () => {
    set("a", 1);
    set("b", 2);
    clear();
    expect(get("a")).toBeUndefined();
    expect(get("b")).toBeUndefined();
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
    del("key");
    expect(cb).toHaveBeenCalledWith(undefined);
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

  test("del dispatches CustomEvent with undefined detail", () => {
    const cb = vi.fn();
    window.addEventListener("relay-state:key", cb);
    set("key", "value");
    del("key");
    const event = cb.mock.calls[1][0] as CustomEvent;
    expect(event.detail).toEqual({ value: undefined });
    window.removeEventListener("relay-state:key", cb);
  });

  test("external CustomEvent triggers subscribers", () => {
    const cb = vi.fn();
    subscribe("ext", cb);
    window.dispatchEvent(new CustomEvent("relay-state:ext", { detail: { value: "external" } }));
    expect(cb).toHaveBeenCalledWith("external");
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

  test("namespaced del removes the prefixed key", () => {
    const store = createStore("appA");
    store.set("key", "value");
    store.del("key");
    expect(get("appA:key")).toBeUndefined();
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
