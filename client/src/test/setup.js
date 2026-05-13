import { vi } from 'vitest'

function createMemoryStorage() {
  const store = new Map()

  return {
    get length() {
      return store.size
    },
    key: vi.fn((index) => Array.from(store.keys())[index] ?? null),
    getItem: vi.fn((key) => store.get(String(key)) ?? null),
    setItem: vi.fn((key, value) => {
      store.set(String(key), String(value))
    }),
    removeItem: vi.fn((key) => {
      store.delete(String(key))
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
  }
}

// Unit tests need deterministic browser APIs. JSDOM's storage can be unavailable
// or partially implemented depending on the runtime flags, so we provide a small
// Storage-compatible mock shared by auth/session tests.
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: createMemoryStorage(),
})

Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  value: createMemoryStorage(),
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
