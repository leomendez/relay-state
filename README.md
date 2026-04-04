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
# pnpm
pnpm add relay-state

# npm
npm install relay-state

# Vite+
vp add relay-state
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

Subscribes to changes for a specific key. The callback fires whenever `set` or `del` is called for that key, including updates originating from other micro frontend bundles. Returns an unsubscribe function.

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

Removes all keys from the store and notifies all active subscribers with `undefined`. Use this for logout flows or full application resets.

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

A namespaced store returns an object with `get`, `set`, `subscribe`, `del`, and `clear` -- the same API as the global functions, scoped to the namespace.

### `RelayStore` (type)

The interface returned by `createStore`:

```ts
interface RelayStore {
  get: <T = unknown>(key: string) => T | undefined;
  set: <T = unknown>(key: string, value: T | ((prev: T | undefined) => T)) => void;
  subscribe: <T = unknown>(key: string, callback: (value: T | undefined) => void) => () => void;
  del: (key: string) => void;
  clear: () => void;
}
```

## React Integration

A React hook is available via the `relay-state/react` entrypoint. It uses [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) under the hood, so your components re-render automatically when shared state changes.

React 18+ is a peer dependency. If it isn't already installed in your project:

> **SSR note:** relay-state is browser-only. It requires `window` at runtime. During server-side rendering, hooks will return `undefined` (or `initialValue` if provided) and no subscriptions are registered.

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

When `initialValue` is provided and the key is currently unset, the value is written to the store on first mount so all consumers see the same default — regardless of which micro frontend mounts first.

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

## Best Practices

### Centralize keys as constants

String keys are the contract between micro frontends. A typo in one app silently breaks the connection with another. Keep all shared keys in a single file, published as a shared package or committed to a common location all apps can import from.

```ts
// packages/shared-keys/index.ts
export const KEYS = {
  user: "user",
  cart: "cart",
  featureFlags: "feature-flags",
} as const;
```

Then import them wherever you use relay-state:

```tsx
import { KEYS } from "@myorg/shared-keys";
import { useRelayState, useRelayStateValue } from "relay-state/react";

function Counter() {
  const [user, setUser] = useRelayState(KEYS.user);
  // ...
}
```

This gives you a single source of truth for the key namespace, makes refactoring safe (rename in one place), and makes it easy to see at a glance what state is shared across your application.

If you are using `createStore` for namespaced stores, the same principle applies -- centralize both the namespace string and the key names:

```ts
// packages/shared-keys/index.ts
export const STORES = {
  appA: "appA",
  appB: "appB",
} as const;

export const APP_A_KEYS = {
  user: "user",
  settings: "settings",
} as const;
```

## How It Works

1. State is stored in an in-memory `Map` -- fast reads and writes with zero serialization overhead.
2. Every `set` and `del` call dispatches a [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) on `window` with the event name `relay-state:{key}`.
3. `subscribe` listens for these events using `window.addEventListener`. When an event arrives, it updates the local cache before calling the callback -- so `get()` always reflects the latest value, even if the event originated from a different bundle.
4. `useRelayState` wires `subscribe` and `get` into React's `useSyncExternalStore`, so components re-render automatically.

Because events go through `window`, the underlying mechanism is framework-agnostic -- any script on the same page can listen. However, relay-state is designed and tested for React. Use in other frameworks is theoretically possible but unsupported.

## Deploying Across Micro Frontends

relay-state works with independently bundled micro frontends — each app can include its own copy of the library. Updates propagate via `window` CustomEvents, and each bundle's local cache stays in sync when it receives an event.

### single-spa

Each micro frontend installs relay-state as a normal dependency. No special configuration is required:

```bash
# pnpm
pnpm add relay-state

# npm
npm install relay-state

# Vite+
vp add relay-state
```

State written by one app is broadcast via `window` events and received by all other apps that have subscribed to the same key, regardless of which bundle they loaded relay-state from.

**Optional: share a single instance via import maps**

If you want all micro frontends to share one bundle of relay-state (slightly more efficient, one fewer module to download), you can register it as a shared dependency in your import map:

```json
{
  "imports": {
    "relay-state": "https://cdn.example.com/relay-state@0.1.0/index.mjs",
    "relay-state/react": "https://cdn.example.com/relay-state@0.1.0/react.mjs"
  }
}
```

Then each micro frontend imports relay-state normally -- the browser resolves it to the shared CDN bundle instead of a local copy. With a shared instance, all apps also share the in-memory cache directly (not just via events), which eliminates any edge cases where a consumer reads `get()` before subscribing.

## Future Ideas

These features are planned but not yet implemented:

**Atom-level defaults.** Today, `initialValue` is set per hook call. A future API would let you define the key, type, and default value together as an atom -- similar to Jotai -- so the default is co-located with the key definition and shared across all consumers automatically:

```ts
// future API (not yet implemented)
const countAtom = atom<number>("count", 0);

function Counter() {
  const [count, setCount] = useRelayState(countAtom);
  // count is always number, never undefined
}
```

**Typed store.** A `createTypedStore` API that encodes the full key-to-type map at the store level, giving compile-time safety without a separate constants file:

```ts
// future API (not yet implemented)
const store = createTypedStore<{
  user: { name: string; role: string };
  count: number;
}>("appA");

store.set("user", { name: "Leo", role: "admin" }); // fully typed
store.set("typo", 1); // TypeScript error
```

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
