import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
// check that previous step installed deps from package.json
export function depsCheck(): boolean {
    core.debug('Checking that previous step installed deps from package.json')
    const workspacePath = process.env.GITHUB_WORKSPACE || ''

    // check that package.json exists in the workspace
    if (!fs.existsSync(`${workspacePath}/package.json`)) {
        throw new Error('package.json does not exist in repository')
    }
    // check that node_modules exists in the workspace
    if (!fs.existsSync(`${workspacePath}/node_modules`)) {
        throw new Error('node_modules does not exist in repository')
    }
    return true;
}

export function osCheck(): boolean {
    core.debug('Checking that the operating system is supported')
    // current only support macos and linux
    if (!(core.platform.isLinux || core.platform.isMacOS)) {
        throw new Error(
            'Unsupported operating system - only Linux and macOS are supported'
        )
    }
    return true
}

// check that dmno is installed
export async function dmnoCheck(): Promise<boolean> {
    try {
        core.debug('Checking that dmno is installed')
        const packageManager = getPackageManager()
        try {
            await exec.exec(`${packageManager} exec dmno`, ['--version'], {
                silent: true,
                cwd: process.env.GITHUB_WORKSPACE || '',
                listeners: {
                    stderr: (data: Buffer) => {
                        core.debug(data.toString())
                    }
                }
            })
        } catch (error) {
            throw new Error(`dmno is not installed or not available in the current working directory, error: ${String(error)}`)
        }

        core.debug('dmno is installed and available')
        return true
    } catch (error: unknown) {
        if (error instanceof Error) {
            core.setFailed(error.message)
            return false
        }
        core.setFailed('An unexpected error occurred')
        return false
    }
}

// detect which package manager is used in the repository
export function getPackageManager(): string {
    core.debug('Checking which package manager is used in the repository')
    const workspacePath = process.env.GITHUB_WORKSPACE || ''
    const packageJsonPath = `${workspacePath}/package.json`

    // Add type safety for package.json parsing
    interface PackageJson {
        packageManager?: string;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson
    const packageManager = packageJson.packageManager

    if (!packageManager) {
        throw new Error('No package manager specified in package.json')
    }

    core.debug(`Package manager: ${packageManager}`)
    return packageManager
}

// run all checks
export async function runAllChecks(): Promise<boolean> {
    osCheck()
    depsCheck()
    await dmnoCheck()
    return true;
}