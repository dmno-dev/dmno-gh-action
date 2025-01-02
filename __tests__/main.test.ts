import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { run } from '../src/main.ts'
import { getPackageManager } from '../src/checks.ts'

// Mock dependencies
vi.mock('@actions/core')
vi.mock('@actions/exec')
vi.mock('../src/checks.ts')

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
        case 'emit-env-vars':
          return 'true'
        case 'output-vars':
          return 'true'
        default:
          return ''
      }
    })
    mockCore.getBooleanInput.mockImplementation(() => false)
  })

  it('should execute dmno resolve with correct arguments', async () => {
    const sampleConfig = {
      configNodes: {
        TEST_VAR: {
          resolvedValue: 'test-value'
        }
      }
    }

    mockExec.exec.mockImplementation(async (_, __, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(JSON.stringify(sampleConfig)))
      }
      return 0
    })

    await run()

    // Verify dmno was executed with correct arguments
    expect(mockExec.exec).toHaveBeenCalledWith(
      'npm exec dmno resolve',
      ['--service test-service', '--format json-full'],
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

    mockExec.exec.mockImplementation(async (_, __, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(
          Buffer.from(JSON.stringify(configWithSensitive))
        )
      }
      return 0
    })

    await run()

    // Verify secret was marked as secret
    expect(mockCore.setSecret).toHaveBeenCalledWith('secret-value')
    expect(mockCore.exportVariable).toHaveBeenCalledWith(
      'SECRET_VAR',
      'secret-value'
    )
  })

  it('should handle output vars when enabled', async () => {
    mockCore.getBooleanInput.mockImplementation((name: string) =>
      name === 'output-vars' ? true : false
    )

    const sampleConfig = {
      configNodes: {
        TEST_VAR: {
          resolvedValue: 'test-value'
        }
      }
    }

    mockExec.exec.mockImplementation(async (_, __, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(JSON.stringify(sampleConfig)))
      }
      return 0
    })

    await run()

    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'dmno',
      JSON.stringify(sampleConfig)
    )
  })

  it('should handle errors gracefully', async () => {
    const errorMessage = 'Command failed'
    mockExec.exec.mockRejectedValue(new Error(errorMessage))

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(errorMessage)
  })

  it('should handle empty config gracefully', async () => {
    mockExec.exec.mockImplementation(async (_, __, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('{}'))
      }
      return 0
    })

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'dmno resolve failed or empty output'
    )
  })
})
