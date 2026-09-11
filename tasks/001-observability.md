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

## Acceptance criteria

- Data-flow inventory names every telemetry destination and its owner.
- No deployed log or trace stores full conversation content by default unless a documented learning requirement needs it.
- Sensitive fields are omitted or redacted before leaving the process.
- CloudWatch retention and least-privilege access are explicit in CDK.
- Operational metrics and correlation IDs remain available without conversation content.
- Verification includes one local and one deployed invocation using synthetic sensitive data.
- Any deliberate content capture is opt-in, environment-specific, access-controlled, and documented with retention limits.

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
