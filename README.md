[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

# DMNO GitHub Action

Use your DMNO config to set outputs and environment variables in your GitHub
Actions workflow. This allows you to more easily reuse config in other steps or
jobs while benefitting from the security and safety features DMNO provides.
Additionally, you no longer need to configure env vars and secrets in the GitHub
UI.\*

> [!IMPORTANT] Currently, you are required to already have a DMNO config file in
> your repository. Get started with DMNO
> [here](https://dmno.dev/docs/get-started/quickstart/)

## Usage

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dmno/dmno-gh-action@v1
        id: dmnoStep
        with:
          service-name: 'my-service'
          base-directory: 'packages/my-service' # defaults to current working directory
          phase: 'dev' # defaults to empty string
          emit-env-vars: false # defaults to true
          output-vars: true # defaults to false
          skip-regex: 'SKIPME.*' # defaults to empty string
          skip-cache: true # defaults to false
          clear-cache: true # defaults to false
      - id: nextStep
        run: |
          echo "DMNO_CONFIG: ${{ steps.dmnoStep.outputs.DMNO_CONFIG }}"
          echo $MY_CONFIG_ITEM
```

## Inputs

- `service-name`: Explicitly select the service to populate config for (useful
  in a monorepo with multiple services)
- `base-directory`: The base directory to generate config for, if not provided,
  the current working directory will be used
- `phase`: The phase of the service to generate config for
- `emit-env-vars`: Whether to emit environment variables, defaults to true
- `output-vars`: Whether to also provide the variables in the output, defaults
  to false
- `skip-regex`: The regex to skip config for, defaults to empty string
- `skip-cache`: Whether to skip the cache, defaults to false
- `clear-cache`: Whether to clear the cache, defaults to false

## Outputs

If `emit-env-vars` is `true`, each of your config variables will be emitted as
an environment variable.

If `output-vars` is `true`, `DMNO_CONFIG` is output as a JSON string of
key/value pairs of the generated variables after being processed by the
`skip-regex` regex.

## Reusing the config in other steps or jobs

You can use the `id` of the DMNO step to reference it in other steps. To reuse
the config in another job, you must create an explicit `output` and then use
that in subsequent jobs. Make sure to use the `needs` block to reference the job
that has the DMNO step.

## Example

```yaml
name: Example Multi-job DMNO GH Action

on: workflow_dispatch

jobs:
  stepWithDmno:
    runs-on: ubuntu-latest
    outputs:
      DMNO_CONFIG: ${{ steps.dmnoStep.outputs.DMNO_CONFIG }}
      SUPABASE_URL: ${{ steps.testOutput.outputs.SUPABASE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
      - uses: pnpm/action-setup@v4
        with:
          version: 9.14.4
          run_install: true
      - uses: dmno-dev/dmno-gh-action@v1
        id: dmnoStep
        env:
          OP_TOKEN: ${{ secrets.OP_TOKEN }}
        with:
          output-vars: true
          service-name: '@dmno-dev/astro-react-supabase-demo'
      - id: testOutput
        run: echo "SUPABASE_URL=$SUPABASE_URL" >> "$GITHUB_OUTPUT"
  nextStep:
    runs-on: ubuntu-latest
    needs: stepWithDmno
    steps:
      - run: echo ${{ needs.stepWithDmno.outputs.DMNO_CONFIG }}
      - run: echo ${{ needs.stepWithDmno.outputs.SUPABASE_URL }}
```

## Secret Zero

If you are using one of the [plugins](https://dmno.dev/docs/plugins/overview/)
you will need to set that plugin's secret in the `env` block, and accordingly in
the GitHub UI. The benefit of this is that, in most cases, you will only need to
set a single _secret zero_ and let DMNO handle the rest.

```yaml
name: Workflow with 1Password Plugin

on: workflow_dispatch

jobs:
  myJob:
    runs-on: ubuntu-latest
    steps:
      # REST OF WORKFLOW
      - uses: dmno-dev/dmno-gh-action@v1
        id: dmnoStep
        env:
          OP_TOKEN: ${{ secrets.OP_TOKEN }}
      # REST OF WORKFLOW
```

## Thank you for checking out DMNO!

If you have any questions or you just want to say hi, please reach out to us on
[Discord](https://chat.dmno.dev)!
