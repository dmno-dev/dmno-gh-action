import * as core from '@actions/core';
import exec from '@actions/exec';
import { getPackageManager } from './checks';

export async function getInputs(): Promise<{ [key: string]: string }> {
  return {
    service: core.getInput('service-name'),
    phase: core.getInput('phase'),
    skipCache: core.getInput('skip-cache'),
    clearCache: core.getInput('clear-cache'),
    baseDirectory: core.getInput('base-directory'),
    emitEnvVars: core.getInput('emit-env-vars'),
    outputVars: core.getInput('output-vars'),
    skipRegex: core.getInput('skip-regex'),
  };
}

export async function createArgString(inputs: { [key: string]: string }): Promise<string> {

  let argString = '';

  // service
  argString += `--service ${inputs.service || 'root'}`;

  // phase
  argString += inputs.phase ? `--phase ${inputs.phase}` : '';

  // skip cache
  argString += inputs.skipCache ? '--skip-cache' : '';

  // clear cache
  argString += inputs.clearCache ? '--clear-cache' : '';

  // json-full so we get all the metadata
  argString += ` --format json-full`;

  return argString;
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const packageManager = await getPackageManager();
    const inputs = await getInputs();
    let resolvedConfig = {};
    await exec.exec(`${packageManager} exec dmno resolve`, [...await createArgString(inputs)], {
      cwd: inputs.baseDirectory || process.env.GITHUB_WORKSPACE || '',
      listeners: {
        stderr: (data: Buffer) => {
          core.debug(data.toString())
        },
        stdout: (data: Buffer) => {
          core.debug(data.toString())
          resolvedConfig = JSON.parse(data.toString());
        }
      }
    })

    if (resolvedConfig === undefined) {
      throw new Error(`dmno resolve failed or empty output`);
    }

    // emit the resolved config as a github action output
    core.exportVariable('resolved-config', JSON.stringify(resolvedConfig));

    // set env vars
    // @ts-ignore
    const output = Object.entries(resolvedConfig.configNodes).forEach(([key, value]: [string, any]) => {
      // skip if skipRegex is set and the key matches
      if (inputs.skipRegex && new RegExp(inputs.skipRegex).test(key)) {
        return;
      }
      // emit env vars
      if (inputs.emitEnvVars) {
        core.exportVariable(key, value.resolvedValue);
      }
      if (value.isSensitive) {
        core.setSecret(value.resolvedValue);
      }
      return {
        name: key,
        value: value.resolvedValue
      }
    });

    // set all outputs at once
    if (inputs.outputVars) {
      core.setOutput('dmno', output);
    }

  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
