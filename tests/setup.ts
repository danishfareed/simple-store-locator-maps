// Vitest setup — keeps tests pure Node so they run without Miniflare.
// Component/service tests use an in-memory SQLite to stand in for D1; route
// tests mock the Shopify authenticate() calls.

// Pre-flight polyfill: Web Crypto is already available in Node >=20, but some
// transitive libs look for `crypto.webcrypto` specifically.
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  // @ts-expect-error — node's webcrypto matches the Web Crypto API surface.
  globalThis.crypto = webcrypto;
}
