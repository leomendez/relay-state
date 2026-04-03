// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { clear, del, set } from "../src/index.ts";
import { useRelayState } from "../src/react.ts";

beforeEach(() => {
  clear();
});

describe("useRelayState", () => {
  test("returns undefined for an unset key", () => {
    const { result } = renderHook(() => useRelayState("missing"));
    expect(result.current).toBeUndefined();
  });

  test("returns initialValue when key is unset", () => {
    const { result } = renderHook(() => useRelayState("missing", "default"));
    expect(result.current).toBe("default");
  });

  test("returns current value when key is already set", () => {
    set("key", "existing");
    const { result } = renderHook(() => useRelayState("key"));
    expect(result.current).toBe("existing");
  });

  test("re-renders when value changes via set", () => {
    const { result } = renderHook(() => useRelayState<string>("key"));
    expect(result.current).toBeUndefined();

    act(() => {
      set("key", "updated");
    });
    expect(result.current).toBe("updated");
  });

  test("re-renders when value is deleted", () => {
    set("key", "value");
    const { result } = renderHook(() => useRelayState("key"));
    expect(result.current).toBe("value");

    act(() => {
      del("key");
    });
    expect(result.current).toBeUndefined();
  });

  test("initialValue is used after delete when key becomes unset", () => {
    set("key", "value");
    const { result } = renderHook(() => useRelayState("key", "fallback"));
    expect(result.current).toBe("value");

    act(() => {
      del("key");
    });
    expect(result.current).toBe("fallback");
  });
});
