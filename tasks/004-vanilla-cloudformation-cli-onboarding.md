# CLI onboarding without L3 CDK

## Context

The application stack currently uses the experimental `@aws/agentcore-cdk` L3 construct to translate
`agentcore/agentcore.json` into CloudFormation. All available package versions are alpha and its declared source
repository is not publicly accessible. We need to know whether plain CloudFormation can provide the same resources while
retaining useful AgentCore CLI operations.

## Investigation

- Build an equivalent application stack as vanilla CloudFormation YAML, without `@aws/agentcore-cdk` or AWS CDK.
- Cover the existing runtime, memory strategies, IAM permissions, VPC attachment, security group, code package, tags,
  environment variables, and outputs.
- Compare its synthesized resources and update/replacement behavior with the current CDK stack.
- Deploy it under a separate test stack and resource names; do not modify or adopt the existing runtime or memory.
- Test documented AgentCore CLI onboarding paths, including `agentcore import runtime` and `agentcore import memory`.
- Determine whether CLI status, invoke, logs, traces, and memory operations work without manually editing
  `agentcore/.cli/deployed-state.json`.
- If documented onboarding fails, identify the minimum compatibility bridge and the exact CLI assumptions it satisfies.
- Record teardown and migration requirements before considering replacement of the current stack.

## Acceptance criteria

- A reviewable CloudFormation YAML template creates an equivalent isolated runtime and memory.
- Template uses only public CloudFormation resource types and documented AWS APIs.
- Resource parity and intentional differences from the current stack are documented.
- Every attempted CLI onboarding command and result is recorded.
- Supported and unsupported CLI operations are demonstrated against the isolated stack.
- Existing `customer-support-agent` resources and deployed-state records remain unchanged during the experiment.
- Recommendation states whether vanilla CloudFormation reduces dependency risk without creating a worse CLI maintenance
  burden.
- Cleanup removes every test resource after evidence is captured.

## Evidence

Attach redacted CloudFormation change sets, stack outputs, CLI command results, resource identity checks, verifier output,
and links to primary AWS documentation.
