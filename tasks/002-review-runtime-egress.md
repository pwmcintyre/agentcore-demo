# runtime egress is overly broad

## Context

CustomerSupport runs in private subnets with NAT-based internet access. Its workload-owned security group currently permits all outbound traffic. Known runtime destinations include Bedrock Runtime and the public Exa MCP endpoint.

## Problem

The lab has not established which outbound destinations are required or whether unrestricted NAT egress is appropriate. Production guidance should demonstrate explicit network boundaries rather than inherit permissive defaults.

## Investigation

- Inventory runtime network calls from application code, AgentCore, Strands, OpenTelemetry, and AWS SDK clients.
- Confirm whether the Exa MCP integration remains necessary for the customer-support use case.
- Capture VPC Flow Logs for representative local and deployed scenarios where applicable.
- Determine which AWS services support interface or gateway VPC endpoints in `ap-southeast-2`.
- Compare current NAT egress with a private-only design using VPC endpoints.
- Test whether runtime security-group egress can be limited to TCP 443 and endpoint security groups.
- Identify DNS, package retrieval, observability, identity, S3, and external MCP dependencies that would break without internet access.
- Estimate recurring NAT and VPC endpoint costs for this lab.

## Acceptance criteria

- Every required outbound destination has an owner, protocol, port, and reason.
- Unused outbound integrations are removed.
- Runtime security-group egress is no broader than required.
- Decision to retain or remove NAT and internet gateway is documented with evidence and cost trade-offs.
- Private-only option lists all required VPC endpoints and known limitations.
- One deployed invocation verifies Bedrock access, required tools, logs, and traces after changes.
- CDK tests assert chosen route and security-group policy.

## Evidence

Attach redacted flow-log samples, relevant CDK diffs, commands used, cost assumptions, and links to primary AWS documentation.
