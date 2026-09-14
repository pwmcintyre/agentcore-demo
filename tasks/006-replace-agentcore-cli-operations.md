# useful CLI operations without ownership

## Context

This repository owns infrastructure through custom CDK and CloudFormation, but still uses AgentCore CLI for local
development and operational commands. Maintaining `agentcore/.cli/deployed-state.json` through a compatibility bridge
shows that these useful commands remain coupled to CLI deployment conventions we do not endorse.

## Investigation

- Inventory the AgentCore CLI commands this repository actually uses, starting with `dev`, `invoke`, `status`, `logs`,
  and `traces`.
- Trace each command to its public AWS API, SDK, local runtime, packaging, signing, log-discovery, and state-file
  dependencies.
- Separate thin convenience wrappers from substantial behavior that would be expensive or risky to reproduce.
- Estimate implementation and ongoing maintenance effort for replacing each command with repository-owned scripts.
- Compare direct replacement, a stable wrapper around AgentCore CLI, and retaining the CLI unchanged per command.
- Prefer AWS SDKs and standard local tooling; do not copy private or unstable CLI implementation unless no public
  interface exists.
- Determine the smallest repository-owned resource manifest or stack-output contract needed by operational scripts.
- Prototype only enough of the highest-value uncertain path to validate the estimate; do not build a replacement suite
  during this investigation.
- Include authentication, streaming responses, session and user headers, CloudWatch pagination, trace correlation,
  local hot reload, cross-platform behavior, testing, and CLI version drift in the estimate.

## Acceptance criteria

- Command inventory records current use, required behavior, backing APIs, and replacement difficulty.
- Effort is estimated separately for initial implementation and ongoing maintenance.
- Security and operational risks are explicit, especially request signing, credentials, payload logging, and state
  discovery.
- Recommendation says replace, wrap, or retain for each command and explains where the ownership boundary should sit.
- Proposed approach works with repository-owned CDK or CloudFormation and does not require `agentcore deploy`.
- Any prototype is small, runnable, tested against deployed resources, and either retained intentionally or removed.
- Follow-up implementation work is split into independently deliverable tasks only if replacement is worthwhile.

## Evidence

Record source/API references, redacted command traces, current bridge behavior, prototype results, and an effort table with
assumptions.
