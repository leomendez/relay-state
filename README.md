# relay-state

> Framework-agnostic shared state store for micro frontends, powered by window
> events and an in-memory cache.

[![CI](https://github.com/leomendez/relay-state/actions/workflows/ci.yml/badge.svg)](https://github.com/leomendez/relay-state/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/relay-state)](https://www.npmjs.com/package/relay-state)
[![license](https://img.shields.io/github/license/leomendez/relay-state)](LICENSE)

## Overview

`relay-state` lets independent micro frontends share state without a shared
runtime or framework coupling. State changes are broadcast via `window`
`CustomEvent`s, so any app on the same page can subscribe — regardless of which
framework (or none) it uses.

The store API is intentionally minimal and designed to plug directly into
React's [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore),
but it works equally well with any subscription-based state primitive.

## Installation

```bash
npm install relay-state
# or
pnpm add relay-state
```

## Usage

<!-- TODO: fill in once the API is implemented -->

```ts
import { createStore } from 'relay-state'

const store = createStore('my-namespace', { count: 0 })

// Subscribe to changes (compatible with useSyncExternalStore)
const unsubscribe = store.subscribe(() => {
  console.log(store.getSnapshot())
})

// Dispatch a state update (broadcasts to all micro frontends on the page)
store.setState({ count: 1 })

unsubscribe()
```

### React integration

```tsx
import { useSyncExternalStore } from 'react'
import { createStore } from 'relay-state'

const store = createStore('my-namespace', { count: 0 })

function Counter() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return <button onClick={() => store.setState({ count: state.count + 1 })}>
    {state.count}
  </button>
}
```

## API

<!-- TODO: document full API once implemented -->

| Export | Description |
|--------|-------------|
| `createStore(namespace, initialState)` | Creates a shared store identified by `namespace` |
| `store.getSnapshot()` | Returns the current in-memory state |
| `store.subscribe(listener)` | Registers a listener; returns an unsubscribe function |
| `store.setState(partial)` | Merges `partial` into the current state and broadcasts the change |

## How it works

1. Each store is keyed by a `namespace` string.
2. On `setState`, the store updates its in-memory cache and dispatches a
   `CustomEvent` on `window` with the new state as the event detail.
3. All subscribers on the same page — including those in other micro frontends
   — receive the event and re-render with the latest state.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Leo Mendez
