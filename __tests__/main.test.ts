import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import fs from 'fs'
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
  const mockFs = vi.mocked(fs)
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

    // Mock filesystem operations
    mockFs.writeFileSync.mockImplementation(() => undefined)
    mockFs.readFileSync.mockImplementation(() => '{}')
  })

  it('should execute dmno resolve with correct arguments', async () => {
    const sampleConfig = {
      configNodes: {
        TEST_VAR: {
          resolvedValue: 'test-value'
        }
      }
    }

    mockFs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig))
    mockExec.getExecOutput.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0
    })

    await run()

    expect(mockExec.getExecOutput).toHaveBeenCalledWith(
      'npm exec dmno resolve --service test-service --format json-full --no-prompt >> /tmp/dmno.json',
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

    mockFs.readFileSync.mockReturnValue(JSON.stringify(configWithSensitive))
    mockExec.getExecOutput.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0
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

    mockFs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig))
    mockExec.getExecOutput.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0
    })

    await run()

    expect(mockCore.setOutput).toHaveBeenCalledWith(
      'dmno',
      JSON.stringify(sampleConfig)
    )
  })

  it('should handle errors gracefully', async () => {
    const errorMessage = 'Command failed'
    mockExec.getExecOutput.mockRejectedValue(new Error(errorMessage))

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(errorMessage)
  })

  it('should handle empty config gracefully', async () => {
    mockFs.readFileSync.mockReturnValue('{"configNodes": {}}')
    mockExec.getExecOutput.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0
    })

    await run()

    expect(mockCore.setFailed).toHaveBeenCalledWith(
      'dmno resolve failed or empty output'
    )
  })
})
