import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { run } from '../src/main.js'
import { getPackageManager } from '../src/checks.js'

// Mock dependencies
vi.mock('@actions/core')
vi.mock('@actions/exec')
vi.mock('fs')
vi.mock('../src/checks.js', () => ({
  getPackageManager: vi.fn(),
  runAllChecks: vi.fn().mockResolvedValue(true)
}))

describe('run', () => {
  const mockCore = vi.mocked(core)
  const mockExec = vi.mocked(exec)
  const mockGetPackageManager = vi.mocked(getPackageManager)

  beforeEach(() => {
    vi.clearAllMocks()

    mockGetPackageManager.mockReturnValue('npm')
    mockCore.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'service-name':
          return 'test-service'
        case 'base-directory':
          return ''
        case 'phase':
          return ''
        case 'skip-regex':
          return ''
        default:
          return ''
      }
    })
    mockCore.getBooleanInput.mockImplementation((name: string) => {
      switch (name) {
        case 'output-vars':
          return true
        case 'emit-env-vars':
          return true
        default:
          return false
      }
    })
  })

  it('should execute dmno resolve with correct arguments', async () => {
    const sampleConfig = {
      configNodes: {
        TEST_VAR: {
          resolvedValue: 'test-value'
        }
      }
    }

    mockExec.getExecOutput.mockImplementation(async (_, __, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(JSON.stringify(sampleConfig)))
      }
      return { stdout: '', stderr: '', exitCode: 0 }
    })

    await run()

    expect(mockExec.getExecOutput).toHaveBeenCalledWith(
      'npm exec -- dmno resolve --service test-service --format json-full --no-prompt',
      [],
      expect.any(Object)
    )
  })

  it('should handle sensitive values correctly', async () => {
    const configWithSensitive = {
      configNodes: {
        SECRET_VAR: {
          resolvedValue: 'secret-value',
          isSensitive: true
        }
      }
    }

    mockExec.getExecOutput.mockImplementation(async (_, __, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from(JSON.stringify(configWithSensitive))
        )
      }
      return { stdout: '', stderr: '', exitCode: 0 }
    })

    await run()

    expect(mockCore.setSecret).toHaveBeenCalledWith('secret-value')
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'SECRET_VAR',
      'secret-value'
    )
  })

  it('should handle output vars when enabled', async () => {
    const sampleConfig = {
      configNodes: {
        TEST_VAR: {
          resolvedValue: 'test-value'
        }
      }
    }

    mockExec.getExecOutput.mockImplementation(async (_, __, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(JSON.stringify(sampleConfig)))
      }
      return { stdout: '', stderr: '', exitCode: 0 }
    })

    await run()

    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'DMNO_CONFIG',
      JSON.stringify({
        TEST_VAR: 'test-value'
      })
    )
  })

  it('should output env vars when emit-env-vars is true', async () => {
    await run()
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'TEST_VAR',
      'test-value'
    )
  })

  it('should not output env vars when emit-env-vars is false', async () => {
    mockCore.getBooleanInput.mockImplementation((name: string) => {
      switch (name) {
        case 'emit-env-vars':
          return false
        default:
          return false
      }
    })
    await run()
    expect(mockCore.exportVariable).not.toHaveBeenCalled()
  })

  it('should skip outputs when skip-regex is provided', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'skip-regex':
          return 'SKIP_.*'
        default:
          return ''
      }
    })
    const sampleConfig = {
      configNodes: {
        SKIP_ME: {
          resolvedValue: 'skip-value'
        },
        SKIP_ME_TOO: {
          resolvedValue: 'skip-value-too'
        },
        DONTSKIP: {
          resolvedValue: 'non-skip-value'
        },
        DONTSKIPTOO: {
          resolvedValue: 'non-skip-value-too'
        }
      }
    }

    mockExec.getExecOutput.mockImplementation(async (_, __, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(JSON.stringify(sampleConfig)))
      }
      return { stdout: '', stderr: '', exitCode: 0 }
    })

    await run()

    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'DMNO_CONFIG',
      JSON.stringify({
        DONTSKIP: 'non-skip-value',
        DONTSKIPTOO: 'non-skip-value-too'
      })
    )
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'DONTSKIP',
      'non-skip-value'
    )
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'DONTSKIPTOO',
      'non-skip-value-too'
    )
  })

  it('should handle errors gracefully', async () => {
    const errorMessage = 'Command failed'
    mockExec.getExecOutput.mockRejectedValue(new Error(errorMessage))

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(errorMessage)
  })

  it('should handle empty config gracefully', async () => {
    const emptyConfig = { configNodes: {} }

    mockExec.getExecOutput.mockImplementation(async (_, __, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(JSON.stringify(emptyConfig)))
      }
      return { stdout: '', stderr: '', exitCode: 0 }
    })

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'dmno resolve failed or empty output'
    )
  })
})
