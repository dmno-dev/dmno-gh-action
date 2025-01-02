import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import {
  depsCheck,
  osCheck,
  dmnoCheck,
  getPackageManager,
  runAllChecks
} from '../src/checks.js'

// Mock dependencies
vi.mock('@actions/core')
vi.mock('@actions/exec')
vi.mock('fs')

describe('checks', () => {
  const mockCore = vi.mocked(core)
  const mockExec = vi.mocked(exec)
  const mockFs = vi.mocked(fs)

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GITHUB_WORKSPACE = '/test/workspace'
  })

  describe('depsCheck', () => {
    it('should pass when package.json and node_modules exist', () => {
      mockFs.existsSync.mockReturnValue(true)
      expect(depsCheck()).toBe(true)
    })

    it('should throw when package.json does not exist', () => {
      mockFs.existsSync.mockImplementation(
        (filePath: fs.PathLike): boolean =>
          !filePath.toString().includes('package.json')
      )
      expect(() => depsCheck()).toThrow(
        'package.json does not exist in repository'
      )
    })

    it('should throw when node_modules does not exist', () => {
      mockFs.existsSync.mockImplementation(
        (filePath: fs.PathLike): boolean =>
          !filePath.toString().includes('node_modules')
      )
      expect(() => depsCheck()).toThrow(
        'node_modules does not exist in repository'
      )
    })
  })

  describe('osCheck', () => {
    it('should pass on Linux', () => {
      mockCore.platform.isLinux = true
      mockCore.platform.isMacOS = false
      expect(osCheck()).toBe(true)
    })

    it('should pass on macOS', () => {
      mockCore.platform.isLinux = false
      mockCore.platform.isMacOS = true
      expect(osCheck()).toBe(true)
    })

    it('should throw on unsupported OS', () => {
      mockCore.platform.isLinux = false
      mockCore.platform.isMacOS = false
      expect(() => osCheck()).toThrow('Unsupported operating system')
    })
  })

  describe('dmnoCheck', () => {
    it('should pass when dmno is installed', async () => {
      mockFs.readFileSync.mockReturnValue('{"packageManager": "npm"}')
      mockExec.exec.mockResolvedValue(0)

      const result = await dmnoCheck()
      expect(result).toBe(true)
      expect(mockExec.exec).toHaveBeenCalledWith(
        'npm exec dmno',
        ['--version'],
        expect.any(Object)
      )
    })

    it('should fail when dmno is not installed', async () => {
      mockFs.readFileSync.mockReturnValue('{"packageManager": "npm"}')
      const testError = new Error('command not found')
      mockExec.exec.mockRejectedValue(testError)

      const result = await dmnoCheck()
      expect(result).toBe(false)
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('dmno is not installed')
      )
    })
  })

  describe('getPackageManager', () => {
    it('should return package manager from package.json', () => {
      mockFs.readFileSync.mockReturnValue('{"packageManager": "yarn@3.0.0"}')
      expect(getPackageManager()).toBe('yarn@3.0.0')
    })

    it('should throw when no package manager is specified', () => {
      mockFs.readFileSync.mockReturnValue('{}')
      expect(() => getPackageManager()).toThrow('No package manager specified')
    })

    it('should throw when package.json is invalid', () => {
      mockFs.readFileSync.mockReturnValue('invalid json')
      expect(() => getPackageManager()).toThrow()
    })
  })

  describe('runAllChecks', () => {
    it('should run all checks successfully', async () => {
      // Setup successful mocks
      mockCore.platform.isLinux = true
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue('{"packageManager": "npm"}')
      mockExec.exec.mockResolvedValue(0)

      const result = await runAllChecks()
      expect(result).toBe(true)
    })

    it('should fail if any check fails', async () => {
      // Make OS check fail
      mockCore.platform.isLinux = false
      mockCore.platform.isMacOS = false

      await expect(runAllChecks()).rejects.toThrow(
        'Unsupported operating system'
      )
    })
  })
})
