# Platform-owned CDK deployment

This CDK app deploys only the CustomerSupport application:

- `../../../platform` is a separate platform-team CDK app. This package does not reference its code.
- `customer-support-agent` imports the platform's documented CloudFormation exports by name.
- `config/types.ts` defines typed environment configuration.
- `config/dev.ts` contains account, region, stack name, and consumer-owned network contract for dev.
- `lib/customerSupport.ts` defines CustomerSupport deployment.

`agentcore.json` remains valid for AgentCore CLI local development. The application stack overlays its deployment-only VPC configuration after parsing that file.

## Deploy

```bash
npm run build
npx cdk deploy CustomerSupportAgent -c stage=dev --profile sca-pwmcintyre --require-approval never
```

The platform team must deploy `platform-network` first. CloudFormation enforces the export contract without coupling the two CDK applications.

Add another typed file such as `config/prod.ts` for each environment, then add it to the stage map in `bin/cdk.ts`. Select it with `-c stage=prod`; constructs receive resolved values through props and never read config or environment variables directly.

## Develop and invoke

Run CLI commands from `CustomerSupport/`, not this CDK directory.

```bash
# Terminal 1: local server
agentcore dev --runtime CustomerSupport --skip-deploy --logs

# Terminal 2: local invocation
agentcore dev --runtime CustomerSupport "What is the price of PROD-001?"

# Remote invocation using .cli/deployed-state.json
agentcore invoke --runtime CustomerSupport "What is the return policy for electronics?"
```

Do not use `agentcore deploy`: CDK owns remote deployment. `agentcore dev` does not depend on deployed state and works unchanged.

`agentcore invoke`, status, logs, and traces read `agentcore/.cli/deployed-state.json`. Update that runtime record from the stack's `RuntimeArn`, `RuntimeId`, and `RuntimeRoleArn` outputs after CDK deployment.

The intended `agentcore import runtime` path was tested but does not currently coexist cleanly:

- Importing as `CustomerSupport` fails because that local runtime already exists.
- Importing under another name fails validation because CloudFormation system tags are copied into the runtime config.

Until the CLI fixes those import paths, deployed-state registration is the smallest working bridge.
