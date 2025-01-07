import * as core from '@actions/core'
import { getExecOutput } from '@actions/exec'
import { getPackageManager, runAllChecks } from './checks.js'
interface InputOptions {
  serviceName: string
  baseDirectory: string
  phase: string
  emitEnvVars: boolean
  outputVars: boolean
  skipRegex: string
  skipCache: boolean
  clearCache: boolean
}

export function getInputs(): InputOptions {
  return {
    serviceName: core.getInput('service-name'),
    baseDirectory: core.getInput('base-directory'),
    phase: core.getInput('phase'),
    emitEnvVars: core.getBooleanInput('emit-env-vars'),
    outputVars: core.getBooleanInput('output-vars'),
    skipRegex: core.getInput('skip-regex'),
    skipCache: core.getBooleanInput('skip-cache'),
    clearCache: core.getBooleanInput('clear-cache')
  }
}

function createArgString(inputs: InputOptions): string[] {
  const args: string[] = []

  // service
  const serviceName = inputs.serviceName || 'root'
  args.push(`--service ${serviceName}`)

  // phase
  if (inputs.phase) {
    args.push(`--phase ${inputs.phase}`)
  }

  // skip cache
  if (inputs.skipCache) {
    args.push('--skip-cache')
  }

  // clear cache
  if (inputs.clearCache) {
    args.push('--clear-cache')
  }

  // json-full so we get all the metadata
  args.push('--format json-full')

  // make cli non-interactive
  args.push('--no-prompt')

  // console.log(args.join(' '))

  return args
}

interface ResolvedConfig {
  configNodes: {
    [key: string]: {
      resolvedValue: string
      isSensitive?: boolean
    }
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    await runAllChecks()
    const packageManager = getPackageManager()
    const inputs = getInputs()
    let resolvedConfig: ResolvedConfig = { configNodes: {} }

    const { stdout, stderr } = await getExecOutput(
      `${packageManager} exec dmno resolve ${createArgString(inputs).join(' ')}`,
      [],
      {
        cwd: inputs.baseDirectory || process.env.GITHUB_WORKSPACE || ''
      }
    )

    if (stderr) {
      core.error(`Error: ${stderr}`)
      throw new Error(`dmno resolve failed or empty output`)
    }

    // Parse the complete output after exec finishes
    try {
      // Clean the string before parsing
      const cleanedOutput = stdout.trim() // Remove leading/trailing whitespace
      core.debug(cleanedOutput)
      resolvedConfig = JSON.parse(cleanedOutput) as ResolvedConfig
    } catch (error) {
      core.debug(
        `Failed to parse JSON output: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }

    if (!resolvedConfig.configNodes) {
      throw new Error(`dmno resolve failed or empty output`)
    }

    if (inputs.outputVars) {
      core.setOutput('dmno', JSON.stringify(resolvedConfig))
    }

    for (const [key, value] of Object.entries(resolvedConfig.configNodes)) {
      if (value.resolvedValue !== undefined) {
        if (value.isSensitive) {
          core.setSecret(value.resolvedValue)
        }
        core.exportVariable(key, value.resolvedValue)
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unexpected error occurred')
    }
  }
}
