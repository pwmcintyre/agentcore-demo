# Objective

This repo exists as a crash course into AWS AgentCore.

It will start by following the workshop "Getting Started with Amazon Bedrock AgentCore":
https://catalog.us-east-1.prod.workshops.aws/workshops/c770f35f-90a9-4e02-8985-4ef912bddb77/en-US

## Goals

Learn all the essential parts of AgentCore.

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-get-started-cli.html
- AgentCore Runtime
- AgentCore Harness
- AgentCore Memory - short-term and long-term memory, retrieval strategies
- AgentCore Gateway - governed connectivity to APIs and MCP servers
- AgentCore Identity - OAuth, API key credential providers, workload identity
- AgentCore Code Interpreter - sandboxed code execution
- AgentCore Observability - traces, logs, and metrics in CloudWatch

And essential parts of Bedrock.

- Guardrails: https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html
- Evaluation: https://docs.aws.amazon.com/bedrock/latest/userguide/evaluation.html

## Non-goals

Non-goals, the following are out of scope for this course

- AgentCore Browser - managed web browsing for agents
- AgentCore Payments - microtransaction payments for agents via x402

## Other constraints

- use AWS_PROFILE=sca-pwmcintyre and AWS_REGION=ap-southeast-2
- use AgentCore inside a VPC
- use Strands SDK in TypeScript (https://strandsagents.com/docs/user-guide/quickstart/typescript/)
- use CloudFormation for deployment, never via Console or CLI
- the application must be observable, with a minimum of JSON formatted canonical logs, and ideally metrics, some of which are out-of-the-box

## Additional resources

- ~/git/agentcore-samples — when looking for sample code
