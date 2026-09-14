# observability leaks conversation payloads

## Context

AgentCore, Strands, OpenTelemetry, application logging, and local CLI logs all contribute observability data. Current testing shows useful traces and logs, but some records appear to include complete user prompts and agent responses.

## Problem

Full conversation payloads may contain personal, confidential, or customer data. We need to understand which layer records each payload, what controls are available, and which data is necessary for operations and evaluation.

## Investigation

- Inventory CloudWatch log groups, traces, metrics, and local files produced by one local and one deployed invocation.
- Map each record to its producer: application, Strands, AgentCore Runtime, AgentCore CLI, or OpenTelemetry instrumentation.
- Record whether prompts, responses, tool inputs, tool outputs, headers, session IDs, user IDs, and exceptions are captured.
- Check redaction, content-capture, sampling, retention, encryption, and access-control settings for each producer.
- Confirm whether disabling payload capture affects AgentCore evaluation, traces, debugging, or metrics.
- Define separate safe defaults for local development and deployed environments.
- Determine how much observability depends on the `@aws/agentcore-cdk` L3 construct rather than the resources and runtime
  configuration it synthesizes. Use the vanilla CloudFormation experiment in
  [`004-vanilla-cloudformation-cli-onboarding.md`](004-vanilla-cloudformation-cli-onboarding.md) to compare equivalent
  deployments with the same application package, `opentelemetry-instrument` entrypoint, environment, and AgentCore
  observability settings.
- Record which L3-generated telemetry settings must be reproduced explicitly in CloudFormation and which telemetry comes
  independently from AgentCore Runtime, AWS ADOT, Strands, Botocore, Memory, MCP, Gateway, and Lambda.

## Acceptance criteria

- Data-flow inventory names every telemetry destination and its owner.
- No deployed log or trace stores full conversation content by default unless a documented learning requirement needs it.
- Sensitive fields are omitted or redacted before leaving the process.
- CloudWatch retention and least-privilege access are explicit in CDK.
- Operational metrics and correlation IDs remain available without conversation content.
- Verification includes one local and one deployed invocation using synthetic sensitive data.
- Any deliberate content capture is opt-in, environment-specific, access-controlled, and documented with retention limits.
- Vanilla CloudFormation observability parity is measured span-by-span against the L3 baseline, with missing spans,
  attributes, metrics, logs, token counts, and cost estimates explained.

## Evidence

Attach representative redacted records, relevant CDK diffs, commands used, and links to primary AWS documentation.

## Initial baseline

Remote validation `E2E-20260911T104910Z` succeeded on 2026-09-11:

- Runtime status was `READY`; response returned the exact marker.
- Invocation session matched trace `6aa3dcaf3798116513bfa2c134ce6700`, which contained 22 spans.
- CloudWatch recorded one invocation and 5,459 ms runtime latency for the validation minute.
- Trace recorded Bedrock model, token counts, time to first token, HTTP status, MCP discovery, and correlated session/trace IDs.
- Runtime contacted the public Exa MCP endpoint during agent initialization even though the prompt did not request web search.
- CLI invocation log stored the complete prompt and response.
- CloudWatch logs and downloaded trace repeated complete system, user, and assistant messages.
- Trace metadata included a temporary credential identifier; no secret value was observed, but this attribute should be removed or justified.
- Runtime log group had no explicit retention period or customer-managed KMS key.
- Logs contained duplicate plain-text, structured application, and OTEL representations plus repeated MCP reconnect noise.

## Gateway trace baseline

Trace `6aa7ccc53f3957b700f3bada7c60f85f` captured a successful warranty Gateway invocation with 24 spans, 4,189 ms agent
latency, 3,686 model tokens, no errors or throttles, and an estimated model cost of $0.005. The complete in-runtime HTTP
request lasted 5,535 ms.

No application code creates spans directly. Telemetry currently comes from several cooperating layers:

- Project dependency `aws-opentelemetry-distro` supplies automatic instrumentation.
- The L3-synthesized runtime starts `main.py` through `opentelemetry-instrument`.
- Strands emits `invoke_agent`, reasoning-cycle, `chat`, and `execute_tool` spans.
- AWS ADOT instrumentation emits Starlette HTTP, Botocore Bedrock/Memory, and MCP client spans.
- AgentCore and CloudWatch receive, correlate, calculate, and display the resulting telemetry.

Observed request shape:

1. `POST /invocations` wrapped the full runtime request.
2. Two `ListEvents` calls and several `CreateEvent` calls loaded and persisted memory session state.
3. Two `mcp tools/list` calls discovered tools from Exa and AgentCore Gateway.
4. Two concurrent `RetrieveMemoryRecords` calls loaded semantic facts and session summaries.
5. First Strands event-loop cycle called Bedrock; model returned `tool_use`.
6. `execute_tool WarrantyCheck___check_warranty` wrapped `mcp tools/call`, which traversed Gateway to Lambda.
7. Second event-loop cycle called Bedrock with tool result and produced final response.

Nested spans describe the same action at different layers rather than duplicate requests: Strands `chat` contains the
Botocore model call, and Strands `execute_tool` contains MCP `tools/call`. The two model calls consumed 1,640 input + 75
output tokens and 1,776 input + 195 output tokens respectively.

The trace also confirmed existing data-exposure concerns: span events contain complete system and user messages, tool
data, and a temporary credential identifier. Do not quote these fields in evidence; redact them before storing or
sharing trace extracts.

Current hypothesis for the CloudFormation experiment: most telemetry should survive removal of the L3 because runtime
libraries emit it after deployment. CloudFormation will probably need to preserve the instrumented entrypoint and any
observability environment/resource settings currently synthesized by L3. Treat this as unverified until identical
synthetic invocations are compared.
