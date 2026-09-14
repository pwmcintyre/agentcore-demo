# AgentCore Project

This project started from the [AgentCore CLI](https://github.com/aws/agentcore-cli) template, then replaced its
generated deployment path with custom CDK. `agentcore dev` remains the local development path; custom CDK owns remote
deployment.

## Project Structure

```
my-project/
├── AGENTS.md               # AI coding assistant context
├── agentcore/
│   ├── agentcore.json      # Project config (agents, memories, credentials, gateways, evaluators)
│   ├── aws-targets.json    # Deployment targets (account + region)
│   ├── .env.local          # Secrets — API keys (gitignored)
│   ├── .llm-context/       # TypeScript type definitions for AI assistants
│   │   ├── agentcore.ts    # AgentCoreProjectSpec types
│   │   └── aws-targets.ts  # Deployment target types
│   └── cdk/                # CDK infrastructure (@aws/agentcore-cdk)
├── app/                    # Agent application code
└── evaluators/             # Custom evaluator code (if any)
```

## Getting Started

### Prerequisites

- **Node.js** 20.x or later
- **Python 3.10+** and **uv** for Python agents ([install uv](https://docs.astral.sh/uv/getting-started/installation/))
- **AWS credentials** configured (`aws configure` or environment variables)
- **Docker** (only for Container build agents)

### Development

Run your agent locally:

```bash
agentcore dev
```

### Validate Invocation Input

Validate runtime invocation payloads before forwarding them to an agent framework. Keep user prompts typed as strings
and pass only prompt text to the agent.

### Deployment

Deploy the prerequisite network from repository root, then the application:

```bash
(cd platform && npx cdk deploy PlatformNetwork --profile sca-pwmcintyre --require-approval never)

(cd ../CustomerSupport/agentcore/cdk && npx cdk deploy CustomerSupportAgent -c stage=dev --profile sca-pwmcintyre --require-approval never)
```

Do not run `agentcore deploy`; it does not own these stacks.

#### CLI and CDK boundary

This split is intentional. Customer-style CDK owns remote infrastructure, including stack names, environments, and
platform network imports. `agentcore dev` remains independent of deployed infrastructure. Remote operational commands
such as `agentcore invoke`, `agentcore status`, `agentcore logs`, and `agentcore traces` work after the registration step
below writes the custom stack outputs to CLI state.

AgentCore resources are not declared as separate vanilla CDK constructs in this repository. `cdk/bin/cdk.ts` reads the
declarative `agentcore/agentcore.json` spec and passes it to the `@aws/agentcore-cdk` L3 `AgentCoreApplication` construct
in `cdk/lib/customerSupport.ts`. That L3 construct synthesizes the runtime, memory, roles, and related CloudFormation
resources. For example, `SharedMemory` is declared in the top-level `memories` array in `agentcore.json`, not by a
`new Memory(...)` call in the CDK stack.

Treat this L3 dependency as experimental. This project pins `@aws/agentcore-cdk` to `0.1.0-alpha.50`; all versions
currently available from npm are alpha releases. The repository URL published in the package metadata returns 404 to
unauthenticated users, so its implementation history and issue tracker are not publicly reviewable. AWS-controlled npm
maintainers and trusted GitHub Actions publishing establish package provenance, but not API stability or support. Review
the synthesized CloudFormation diff and run the end-to-end verifier before accepting any package upgrade.

`agentcore deploy` is not compatible with the current stack. The CLI requires the synthesized stack name
`AgentCore-CustomerSupport-default`, but this project deliberately deploys `customer-support-agent`. Renaming an existing
CloudFormation stack requires a migration, not a configuration-only change. See
[`tasks/003-agentcore-cli-cdk-boundary.md`](../tasks/003-agentcore-cli-cdk-boundary.md) for supported features and the
onboarding contract.

### Runtime registration and verification

AgentCore CLI commands resolve deployed resources through `agentcore/.cli/deployed-state.json`. Custom CDK cannot
populate that file itself. The official `agentcore import runtime` command was tested, but currently rejects the
existing local runtime name and fails schema validation under an alias because it copies CloudFormation system tags.

Run the bridge and complete end-to-end check from `CustomerSupport/` after each relevant deployment:

```bash
./scripts/verify-deployment.sh
```

The script has two responsibilities:

- **CLI state bridge:** It reads runtime and memory IDs and ARNs from CloudFormation outputs, then writes the shape that
  AgentCore operational commands expect in `agentcore/.cli/deployed-state.json`. Without this step, resources deployed
  by custom CDK appear `local-only` or cannot be addressed by the CLI.
- **Deployment smoke test:** It invokes the runtime with a synthetic marker and user identity, checks that the runtime is
  `READY` and memory is `deployed`, then correlates CloudWatch logs and traces by session ID.

It prints one `PASS` line and avoids printing conversation content. Its stack name, resource names, and output prefixes
are project-specific compatibility code. Update it when adding another AgentCore resource type. The bridge can be
removed if deployment moves to a supported workflow that populates CLI state itself, such as a compatible
`agentcore deploy` lifecycle.

## Commands

| Command | Description |
| --- | --- |
| `agentcore create` | Create a new AgentCore project |
| `agentcore add` | Add resources (agent, memory, credential, gateway, evaluator, policy) |
| `agentcore remove` | Remove resources |
| `agentcore dev` | Run agent locally with hot-reload |
| `agentcore deploy` | Unsupported here; custom CDK owns deployment |
| `agentcore status` | Show deployment status |
| `agentcore invoke` | Invoke agent (local or deployed) |
| `agentcore logs` | View agent logs |
| `agentcore traces` | View agent traces |
| `agentcore eval` | Run evaluations |
| `agentcore package` | Package agent artifacts |
| `agentcore validate` | Validate configuration |
| `agentcore pause` | Pause a deployed agent |
| `agentcore resume` | Resume a paused agent |
| `agentcore fetch` | Fetch remote resource definitions |
| `agentcore import` | Import existing resources |
| `agentcore update` | Check for CLI updates |

## Configuration

Edit the JSON files in `agentcore/` to configure your project. See `agentcore/.llm-context/` for type definitions and validation constraints.

The project uses a **flat resource model** — agents, memories, credentials, gateways, evaluators, and policies are top-level arrays in `agentcore.json`. Resources are independent; agents discover memories and credentials at runtime via environment variables or SDK calls.

## Resources

| Resource | Purpose |
| --- | --- |
| Agent (runtime) | HTTP, MCP, or A2A agent deployed to AgentCore Runtime |
| Memory | Persistent context storage with configurable strategies |
| Credential | API key or OAuth credential providers |
| Gateway | MCP gateway that routes tool calls to targets |
| Gateway Target | Tool implementation (Lambda, MCP server, OpenAPI, Smithy, API Gateway) |
| Evaluator | Custom LLM-as-a-Judge or code-based evaluation |
| Online Eval Config | Continuous evaluation pipeline for deployed agents |
| Policy | Cedar authorization policies for gateway tools |

### Agent Types

- **Template agents**: Created from framework templates (Strands, LangChain/LangGraph, GoogleADK, OpenAI Agents, Autogen)
- **BYO agents**: Bring your own code with `agentcore add agent --type byo`
- **Import agents**: Import existing Bedrock agents with `agentcore import`

### Build Types

- **CodeZip**: Python source packaged as a zip and deployed directly to AgentCore Runtime
- **Container**: Docker image built via CodeBuild (ARM64), pushed to ECR, and deployed to AgentCore Runtime

## Documentation

- [AgentCore CLI](https://github.com/aws/agentcore-cli)
- [`@aws/agentcore-cdk` on npm](https://www.npmjs.com/package/@aws/agentcore-cdk)
- [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)
