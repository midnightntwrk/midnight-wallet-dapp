import { Buffer } from 'buffer'
import process from 'process'

// Setup global polyfills
globalThis.Buffer = Buffer
globalThis.process = process
globalThis.global = globalThis

// Initialize process.env if it doesn't exist
if (!process.env) {
  process.env = {}
}

// Inject environment variables
// @ts-ignore - Vite will replace this at build time
process.env.MIDNIGHT_STORAGE_PASSWORD = __MIDNIGHT_STORAGE_PASSWORD__
