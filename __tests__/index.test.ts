/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

import { describe, it, expect, vi } from 'vitest'
import * as main from '../src/main.js'

// Mock the main module
vi.mock('../src/main.js', () => ({
  run: vi.fn().mockImplementation(async () => Promise.resolve())
}))

describe('index', () => {
  it('calls run when imported', async () => {
    await import('../src/index.js')
    expect(main.run).toHaveBeenCalled()
  })
})
