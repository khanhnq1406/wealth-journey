// Polyfill fetch, Headers, Request, and Response for MSW in Jest/jsdom environment
// This file must be loaded before any other test files (setupFiles)
const { TextDecoder, TextEncoder } = require('util')
const { ReadableStream, WritableStream, TransformStream } = require('stream/web')

// Web Streams API polyfills required by MSW v2 / @mswjs/interceptors
global.ReadableStream = global.ReadableStream || ReadableStream
global.WritableStream = global.WritableStream || WritableStream
global.TransformStream = global.TransformStream || TransformStream
global.TextDecoder = global.TextDecoder || TextDecoder
global.TextEncoder = global.TextEncoder || TextEncoder

// Polyfill fetch using undici (Node.js built-in)
const nodeFetch = require('node-fetch')
if (!global.fetch) {
  global.fetch = nodeFetch
  global.Headers = nodeFetch.Headers
  global.Request = nodeFetch.Request
  global.Response = nodeFetch.Response
}

// Also polyfill for the global scope
global.AbortController = global.AbortController || require('abort-controller')

// BroadcastChannel polyfill required by MSW v2 WebSocket mocking
if (!global.BroadcastChannel) {
  global.BroadcastChannel = class BroadcastChannel {
    constructor() { this.onmessage = null }
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
}
