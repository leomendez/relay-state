// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { clear, del, set } from "../src/index.ts";
import { useRelayState, useRelayStateValue, useSetRelayState } from "../src/react.ts";

beforeEach(() => {
  clear();
});

describe("useRelayState (tuple)", () => {
  test("returns undefined value for an unset key", () => {
    const { result } = renderHook(() => useRelayState("missing"));
    const [value] = result.current;
    expect(value).toBeUndefined();
  });

  test("returns initialValue when key is unset", () => {
    const { result } = renderHook(() => useRelayState("missing", "default"));
    const [value] = result.current;
    expect(value).toBe("default");
  });

  test("returns current value when key is already set", () => {
    set("key", "existing");
    const { result } = renderHook(() => useRelayState("key"));
    const [value] = result.current;
    expect(value).toBe("existing");
  });

  test("re-renders when value changes via set", () => {
    const { result } = renderHook(() => useRelayState<string>("key"));
    expect(result.current[0]).toBeUndefined();

    act(() => {
      set("key", "updated");
    });
    expect(result.current[0]).toBe("updated");
  });

  test("re-renders when value is deleted", () => {
    set("key", "value");
    const { result } = renderHook(() => useRelayState("key"));
    expect(result.current[0]).toBe("value");

    act(() => {
      del("key");
    });
    expect(result.current[0]).toBeUndefined();
  });

  test("initialValue is used after delete when key becomes unset", () => {
    set("key", "value");
    const { result } = renderHook(() => useRelayState("key", "fallback"));
    expect(result.current[0]).toBe("value");

    act(() => {
      del("key");
    });
    expect(result.current[0]).toBe("fallback");
  });

  test("setter updates state with a direct value", () => {
    const { result } = renderHook(() => useRelayState<number>("count", 0));

    act(() => {
      const [, setCount] = result.current;
      setCount(42);
    });
    expect(result.current[0]).toBe(42);
  });

  test("setter updates state with an updater function", () => {
    set("count", 5);
    const { result } = renderHook(() => useRelayState<number>("count"));

    act(() => {
      const [, setCount] = result.current;
      setCount((prev) => (prev ?? 0) + 1);
    });
    expect(result.current[0]).toBe(6);
  });

  test("setter is referentially stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useRelayState<number>("count"));
    const [, setter1] = result.current;

    act(() => {
      set("count", 1);
    });
    rerender();
    const [, setter2] = result.current;

    expect(setter1).toBe(setter2);
  });
});

describe("useRelayStateValue", () => {
  test("returns undefined for an unset key", () => {
    const { result } = renderHook(() => useRelayStateValue("missing"));
    expect(result.current).toBeUndefined();
  });

  test("returns initialValue when key is unset", () => {
    const { result } = renderHook(() => useRelayStateValue("missing", "default"));
    expect(result.current).toBe("default");
  });

  test("returns current value when key is already set", () => {
    set("key", "existing");
    const { result } = renderHook(() => useRelayStateValue("key"));
    expect(result.current).toBe("existing");
  });

  test("re-renders when value changes via set", () => {
    const { result } = renderHook(() => useRelayStateValue<string>("key"));
    expect(result.current).toBeUndefined();

    act(() => {
      set("key", "updated");
    });
    expect(result.current).toBe("updated");
  });

  test("re-renders when value is deleted", () => {
    set("key", "value");
    const { result } = renderHook(() => useRelayStateValue("key"));
    expect(result.current).toBe("value");

    act(() => {
      del("key");
    });
    expect(result.current).toBeUndefined();
  });
});

describe("useSetRelayState", () => {
  test("returns a function", () => {
    const { result } = renderHook(() => useSetRelayState("key"));
    expect(typeof result.current).toBe("function");
  });

  test("calling it with a value updates the store", () => {
    const { result } = renderHook(() => useSetRelayState<number>("count"));

    act(() => {
      result.current(10);
    });
    expect(set("count", (prev) => prev)).toBe(undefined); // side-effect free check
    // verify via a value hook
    const { result: valueResult } = renderHook(() => useRelayStateValue<number>("count"));
    expect(valueResult.current).toBe(10);
  });

  test("calling it with an updater function updates the store", () => {
    set("count", 5);
    const { result } = renderHook(() => useSetRelayState<number>("count"));

    act(() => {
      result.current((prev) => (prev ?? 0) + 1);
    });
    const { result: valueResult } = renderHook(() => useRelayStateValue<number>("count"));
    expect(valueResult.current).toBe(6);
  });

  test("component does not re-render when state changes", () => {
    const renderCount = { current: 0 };
    const { result } = renderHook(() => {
      renderCount.current++;
      return useSetRelayState<number>("count");
    });

    const initialRenders = renderCount.current;

    act(() => {
      result.current(1);
    });
    act(() => {
      result.current(2);
    });
    act(() => {
      result.current(3);
    });

    // Setter-only component should not have re-rendered due to state changes
    expect(renderCount.current).toBe(initialRenders);
  });

  test("setter is referentially stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useSetRelayState<number>("count"));
    const setter1 = result.current;

    rerender();
    const setter2 = result.current;

    expect(setter1).toBe(setter2);
  });
});
