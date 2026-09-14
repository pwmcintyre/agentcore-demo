# agentcore-demo

## Tasks

Open follow-up work lives in [`tasks/`](tasks/). Review this directory regularly, especially before starting a new lab phase or treating the demo as production guidance.

## findings

### platform infrastructure stays separate

The VPC and private subnets were split into the independent [`platform/`](platform/) CDK application. This reflects a
typical enterprise boundary: platform teams own shared network constructs, while application stacks import and use
them rather than create their own network.

### custom CDK crosses CLI ownership

AgentCore CLI assumes it owns deployment, including stack naming, target mapping, resource outputs, and local deployed
state. Customer-style CDK needs control over those concerns so it can consume platform infrastructure and follow
environment conventions. This project therefore uses custom `cdk deploy` for remote infrastructure, keeps
`agentcore dev` for local work, and registers CDK outputs so `agentcore invoke`, status, logs, and traces remain useful.
`agentcore deploy` is not supported without migrating to its fixed lifecycle contract. See
[`tasks/003-agentcore-cli-cdk-boundary.md`](tasks/003-agentcore-cli-cdk-boundary.md).

Review draft [AgentCore CLI PR #2249](https://github.com/aws/agentcore-cli/pull/2249) periodically. It proposes a
documented customer extension point for generated CDK but is not yet merged or released.
