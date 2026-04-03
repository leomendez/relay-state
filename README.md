# relay-state

> Shared state for micro frontends, designed for React.

[![CI](https://github.com/leomendez/relay-state/actions/workflows/ci.yml/badge.svg)](https://github.com/leomendez/relay-state/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/relay-state)](https://www.npmjs.com/package/relay-state)
[![license](https://img.shields.io/github/license/leomendez/relay-state)](LICENSE)

## The Problem

In micro frontend architectures like [single-spa](https://single-spa.js.org/), independently deployed sub-applications share a single browser window but have no built-in way to share state. When App A updates a user's profile, App B has no idea it happened.

Common workarounds -- module federation, custom event buses cobbled together per team, or dumping state into `localStorage` -- are either heavyweight, fragile, or require framework coupling.

**relay-state** solves this with a minimal approach: an **in-memory cache** backed by **window `CustomEvent` dispatch**. Any micro frontend on the page can read, write, and subscribe to shared state. The library is designed for React -- the subscription API plugs directly into `useSyncExternalStore` and a first-class `useRelayState` hook is included. The core event mechanism is framework-agnostic in principle, but React is the primary target and the only officially supported integration.

## Install

```bash
npm install relay-state
```

## Quick Start

```tsx
import { useRelayState, useRelayStateValue, useSetRelayState } from "relay-state/react";

// Tuple API — like useState, but shared across micro frontends
function Counter() {
  const [count, setCount] = useRelayState<number>("count", 0);
  return <button onClick={() => setCount((n) => (n ?? 0) + 1)}>Count: {count}</button>;
}

// Read-only — re-renders on changes, no setter
function UserBadge() {
  const user = useRelayStateValue<{ name: string; role: string }>("user");
  if (!user) return null;
  return (
    <span>
      {user.name} ({user.role})
    </span>
  );
}

// Write-only — does NOT re-render when state changes
function PromoteButton() {
  const setUser = useSetRelayState<{ name: string; role: string }>("user");
  return <button onClick={() => setUser((u) => ({ ...u, role: "admin" }))}>Promote</button>;
}
```

## API

### `get<T>(key: string): T | undefined`

Returns the current value for a key, or `undefined` if the key has not been set.

```ts
const count = get<number>("count"); // number | undefined
```

### `set<T>(key: string, value: T | ((prev: T | undefined) => T)): void`

Sets a value in the store and dispatches a `CustomEvent` on `window` to notify all subscribers. Accepts either a direct value or an updater function.

```ts
// Direct value
set("count", 0);

// Updater function (receives the previous value)
set<number>("count", (prev) => (prev ?? 0) + 1);
```

> **Note:** Because updater functions are detected via `typeof value === "function"`, storing a function as a value requires wrapping it: `set("callback", () => myFunction)`. This is the same tradeoff React's `useState` makes.

### `subscribe<T>(key: string, callback: (value: T | undefined) => void): () => void`

Subscribes to changes for a specific key. The callback fires whenever `set` or `del` is called for that key. Returns an unsubscribe function.

```ts
const unsubscribe = subscribe<number>("count", (value) => {
  console.log("Count is now:", value);
});

// Stop listening
unsubscribe();
```

This signature is designed to work directly with React's [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore).

### `del(key: string): void`

Deletes a key from the store and notifies subscribers with `undefined`.

```ts
del("count");
```

### `clear(): void`

Removes all keys from the store. Does not dispatch events -- this is a hard reset, useful for testing or hot reload cleanup.

```ts
clear();
```

### `createStore(namespace: string): RelayStore`

Creates a namespaced store. All keys are internally prefixed with `namespace:`, preventing collisions between micro frontends while sharing the same underlying cache and event bus.

```ts
import { createStore } from "relay-state";

// In App A
const appA = createStore("appA");
appA.set("user", { name: "Leo" });
appA.get("user"); // { name: "Leo" }

// In App B
const appB = createStore("appB");
appB.set("user", { name: "Maria" });
appB.get("user"); // { name: "Maria" }

// No collision -- these are stored as "appA:user" and "appB:user"
```

A namespaced store returns an object with `get`, `set`, `subscribe`, and `del` -- the same API as the global functions.

### `RelayStore` (type)

The interface returned by `createStore`:

```ts
interface RelayStore {
  get: <T = unknown>(key: string) => T | undefined;
  set: <T = unknown>(key: string, value: T | ((prev: T | undefined) => T)) => void;
  subscribe: <T = unknown>(key: string, callback: (value: T | undefined) => void) => () => void;
  del: (key: string) => void;
}
```

## React Integration

A React hook is available via the `relay-state/react` entrypoint. It uses [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) under the hood, so your components re-render automatically when shared state changes.

```bash
# React 18+ is required as a peer dependency
npm install react
```

### `useRelayState<T>(key, initialValue?) → [value, setter]`

The primary hook. Returns a tuple of the current value and a setter — the same pattern as React's `useState`.

```tsx
import { useRelayState } from "relay-state/react";

function Counter() {
  const [count, setCount] = useRelayState<number>("count", 0);
  return <button onClick={() => setCount((prev) => (prev ?? 0) + 1)}>Count: {count}</button>;
}
```

The setter accepts either a direct value or an updater function:

```ts
setCount(10);
setCount((prev) => (prev ?? 0) + 1);
```

### `useRelayStateValue<T>(key, initialValue?) → value`

Subscribes to a key and returns only the current value. Use this when a component needs to read state but never write it.

```tsx
import { useRelayStateValue } from "relay-state/react";

function UserBadge() {
  const user = useRelayStateValue<{ name: string }>("user");
  if (!user) return null;
  return <span>{user.name}</span>;
}
```

### `useSetRelayState<T>(key) → setter`

Returns a stable setter function without subscribing to state changes. Components using only this hook will **not re-render** when the value changes — the key performance primitive for write-only components.

```tsx
import { useSetRelayState } from "relay-state/react";

function PromoteButton() {
  const setUser = useSetRelayState<{ name: string; role: string }>("user");
  return (
    <button onClick={() => setUser((prev) => ({ ...prev, role: "admin" }))}>
      Promote to Admin
    </button>
  );
}
```

The `relay-state/react` entrypoint also re-exports all core functions (`get`, `set`, `del`, `subscribe`, `createStore`, `clear`) and the `RelayStore` type for convenience.

## How It Works

1. State is stored in an in-memory `Map` -- fast reads and writes with zero serialization overhead.
2. Every `set` and `del` call dispatches a [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) on `window` with the event name `relay-state:{key}`.
3. `subscribe` listens for these events using `window.addEventListener`.
4. `useRelayState` wires `subscribe` and `get` into React's `useSyncExternalStore`, so components re-render automatically.

Because events go through `window`, the underlying mechanism is framework-agnostic -- any script on the same page can listen. However, relay-state is designed and tested for React. Use in other frameworks is theoretically possible but unsupported.

## Not the Right Fit?

relay-state is purpose-built for **cross-micro-frontend state sharing** in React-based architectures like single-spa where independently deployed apps share a browser window. It is intentionally minimal and not a general-purpose state manager.

If you need a full-featured state management solution within a single React application, consider:

- **[Zustand](https://github.com/pmndrs/zustand)** -- A small, fast, and scalable state management library for React. Great for app-level state with a simple hook-based API.
- **[Jotai](https://github.com/pmndrs/jotai)** -- Primitive and flexible atomic state management for React. Ideal when you want fine-grained, bottom-up state composition.

Both are excellent choices for React application state. relay-state fills a different niche: lightweight state that needs to cross micro frontend boundaries.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) &copy; Leo Mendez
