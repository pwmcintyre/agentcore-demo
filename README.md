# agentcore-demo

## Deployment

Deploy the workshop prerequisites once per account and region. This standalone CloudFormation stack contains the Cognito
configuration, warranty and refund Lambda functions, IAM roles, and SSM parameters assumed by later workshop labs:

```bash
aws cloudformation deploy \
  --template-file workshop-prerequisites/template.yaml \
  --stack-name agentcore-workshop-prereqs \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile sca-pwmcintyre \
  --region ap-southeast-2
```

Then deploy shared networking from `platform/` and the AgentCore application from `CustomerSupport/agentcore/cdk/` as
documented in their READMEs. The prerequisites template is copied from the AWS workshop self-paced setup; unlike its
published launch links, this repository deploys it in `ap-southeast-2`.

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

## review

### resource authoring is CLI-centric

The workshop creates resources by running mutation commands such as
`agentcore add gateway --name my-gateway --runtimes CustomerSupport`. These commands generate or modify project
configuration through a CLI-led workflow before `agentcore deploy` interprets it. The resulting JSON can be committed
and reviewed, but the primary authoring path is still an imperative command with prompts and CLI-owned conventions.

That is a poor fit for this repository. Infrastructure changes should be made directly in declarative CDK or
CloudFormation, preferably through a reviewed code change produced by a developer or coding agent. Deployment should
then synthesize and apply that exact source without requiring an interactive setup step or hidden local state. Until
AgentCore exposes a stable, public IaC interface for every resource type, this is another reason not to endorse
AgentCore CLI as the infrastructure authoring and deployment boundary.
