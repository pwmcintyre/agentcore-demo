# Lab 3 resources come from prerequisites

## Finding

Lab 3 does not create its warranty Lambda or ARN parameter. For self-paced users, both are created together in **Prerequisites → Self-paced Setup → Part 3: Deploy the Prerequisites Stack**, before Lab 1. The participant launches a CloudFormation stack named `agentcore-workshop-prereqs`; its `prereqs.yaml` defines both resources.

For AWS-event users, Workshop Studio provisions the account and development environment before participants enter the labs. The workshop says the Lambda is already created, but does not publish the event provisioning template or identify the stack, script, or command that creates it. Treat event implementation details beyond automatic pre-provisioning as unknown, not as equivalent to the self-paced stack.

Sources reviewed on 2026-09-14: current Workshop Studio build `5311faec-4630-4bbe-b5d9-c8929d8b4661`, plus the workshop-linked first-party [`aws/agentcore-cli`](https://github.com/aws/agentcore-cli) repository.

## Exact creation point

### Self-paced path

The workshop's [Self-paced Setup](https://catalog.us-east-1.prod.workshops.aws/workshops/c770f35f-90a9-4e02-8985-4ef912bddb77/en-US/10-prereqs/12-self-paced) says, before Lab 1, that users need "a small CloudFormation stack that provisions shared resources (Cognito, a Lambda function, and SSM parameters)." Under **Part 3: Deploy the Prerequisites Stack**, it states that the stack creates:

- Lambda function `workshop-warranty-check`, used as Lab 3's Gateway target.
- SSM parameters storing ARNs and configuration, including `/app/customersupport/agentcore/warranty_check_lambda_arn`.

Creation is a manual CloudFormation console action through a pre-filled **Launch Stack** link. Documented stack name: `agentcore-workshop-prereqs`. User reviews defaults, acknowledges named IAM resources, selects **Create stack**, and waits for `CREATE_COMPLETE`.

Region-specific templates:

- [`us-east-1` `prereqs.yaml`](https://ws-assets-prod-iad-r-iad-ed304a55c2ca1aee.s3.us-east-1.amazonaws.com/c770f35f-90a9-4e02-8985-4ef912bddb77/prereqs.yaml)
- [`us-west-2` `prereqs.yaml`](https://ws-assets-prod-iad-r-pdx-f3b3f9f1a7d6a3d0.s3.us-west-2.amazonaws.com/c770f35f-90a9-4e02-8985-4ef912bddb77/prereqs.yaml)

Both fetched templates are identical for these resources:

```yaml
WarrantyCheckFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: workshop-warranty-check
    Runtime: python3.13
    Architectures: [arm64]
    Handler: index.handler
    Role: !GetAtt WarrantyCheckLambdaRole.Arn
    Timeout: 10
    Code:
      ZipFile: |
        # Inline Python warranty lookup and handler

WarrantyCheckLambdaArnParameter:
  Type: AWS::SSM::Parameter
  Properties:
    Name: /app/customersupport/agentcore/warranty_check_lambda_arn
    Type: String
    Value: !GetAtt WarrantyCheckFunction.Arn
    Description: ARN of the warranty check Lambda function for AgentCore Gateway
```

Related exact resource names:

- Lambda logical ID: `WarrantyCheckFunction`
- Lambda physical name: `workshop-warranty-check`
- Lambda execution role logical ID: `WarrantyCheckLambdaRole`
- Lambda execution role physical name: `workshop-lambda-role`
- SSM parameter logical ID: `WarrantyCheckLambdaArnParameter`
- SSM parameter name: `/app/customersupport/agentcore/warranty_check_lambda_arn`
- Parameter value: `!GetAtt WarrantyCheckFunction.Arn`

Minor workshop mismatch: Lab 3 tells users to review the Lambda code in `main.py`, while the prerequisite template uses inline `ZipFile` code with `Handler: index.handler`. CloudFormation stores inline Python Lambda source as `index.py`; no `main.py` is created by this template. This does not affect the ARN or Gateway target.

The workshop documents only this verification command after creation:

```bash
aws cloudformation describe-stacks \
  --stack-name agentcore-workshop-prereqs \
  --query 'Stacks[0].StackStatus' --output text
```

It does not document an `aws cloudformation deploy`/`create-stack` command. No setup script, notebook, AgentCore CLI command, or Lab 1/Lab 2 action creates these two resources.

### AWS-event path

[AWS Event Setup](https://catalog.us-east-1.prod.workshops.aws/workshops/c770f35f-90a9-4e02-8985-4ef912bddb77/en-US/10-prereqs/11-at-aws), **Part 2: Open the Code Editor**, says the environment "is provisioned automatically when the event starts." [Lab 3](https://catalog.us-east-1.prod.workshops.aws/workshops/c770f35f-90a9-4e02-8985-4ef912bddb77/en-US/40-lab3-gateway), **Step 1: Verify the AWS Lambda Function**, says `workshop-warranty-check` "has already been created for you."

That is the full documented origin for event accounts. The public workshop does not identify the event CloudFormation stack, template, setup script, notebook, CLI command, or manual console action responsible. It also does not explicitly explain creation of the event account's SSM parameter; Step 1 immediately reads the same parameter, so its presence is a lab dependency, but attributing it to a particular event mechanism would be an assumption.

The workshop-linked `aws/agentcore-cli` repository does not contain this workshop content, `prereqs.yaml`, `workshop-warranty-check`, or its SSM parameter in its current `main` tree. Therefore it supplies no additional event-provisioning evidence despite AWS Event Setup saying workshop content is available there.

## Lab 3 consumption, not creation

[Lab 3](https://catalog.us-east-1.prod.workshops.aws/workshops/c770f35f-90a9-4e02-8985-4ef912bddb77/en-US/40-lab3-gateway), **Step 1: Verify the AWS Lambda Function**, reads the ARN:

```bash
WARRANTY_LAMBDA_ARN=$(aws ssm get-parameter \
  --name /app/customersupport/agentcore/warranty_check_lambda_arn \
  --query 'Parameter.Value' --output text)
```

Then **Step 3: Add Gateway and Target via CLI** consumes that ARN:

```bash
agentcore add gateway --name my-gateway --runtimes CustomerSupport

agentcore add gateway-target \
  --type lambda-function-arn \
  --name WarrantyCheck \
  --lambda-arn $WARRANTY_LAMBDA_ARN \
  --tool-schema-file app/CustomerSupport/tool/warranty_schema.json \
  --gateway my-gateway
```

These commands update AgentCore project configuration. **Step 5: Deploy** runs `agentcore deploy -y -v` to create Gateway `my-gateway`, target `WarrantyCheck`, IAM resources, and runtime updates. It does not create the pre-existing Lambda or SSM parameter.

Lab 1 creates and deploys the `CustomerSupport` AgentCore runtime. Lab 2 creates `SharedMemory`. Neither lab mentions or creates the warranty Lambda or parameter. This matches Lab 2's closing statement that Lab 3 will expose an "existing Lambda."

## Region constraints

The self-paced prerequisite page supports only `us-east-1` and `us-west-2` and says to use one region consistently. AWS CLI commands rely on the configured default region; the SSM parameter is regional and must be read from the same region where the prerequisites stack ran.

This conflicts with this repo's required `AWS_REGION=ap-southeast-2` in [`OBJECTIVE.md`](../OBJECTIVE.md). Workshop
instructions provide no `ap-southeast-2` launch link or support claim. Deployment in this repository subsequently proved
the template works there, but that remains outside the workshop's documented regions.

## Repository resolution

The repository originally never performed or reproduced self-paced **Part 3**:

- Before Lab 3 configuration, [`CustomerSupport/agentcore/agentcore.json`](../CustomerSupport/agentcore/agentcore.json)
  had `agentCoreGateways: []`; no `my-gateway` or `WarrantyCheck` target existed.
- [`platform/lib/network-stack.ts`](../platform/lib/network-stack.ts) creates only VPC networking and exports.
- [`CustomerSupport/agentcore/cdk/lib/customerSupport.ts`](../CustomerSupport/agentcore/cdk/lib/customerSupport.ts) deploys resources derived from `agentcore.json`, adds runtime VPC configuration/security group, and exports runtime identity. It defines no Lambda or SSM parameter.
- Before resolution, repo-wide source search found no `workshop-warranty-check` or
  `/app/customersupport/agentcore/warranty_check_lambda_arn` resource.

Root cause: custom onboarding followed Labs 1 and 2 while omitting the separate prerequisite stack. Lab 3 assumes that
external shared stack already exists.

Resolved on 2026-09-14 by adding the workshop template at
[`workshop-prerequisites/template.yaml`](../workshop-prerequisites/template.yaml) and deploying it as
`agentcore-workshop-prereqs` in `ap-southeast-2`. CloudFormation reached `CREATE_COMPLETE`, every stack resource completed,
the SSM value matched the Lambda ARN, and invoking `workshop-warranty-check` for `PROD-001` returned the expected warranty
record. Gateway configuration remains separate Lab 3 work.

Lab 3 subsequently added and deployed `my-gateway` with target `WarrantyCheck`. The custom stack required an explicit
`AgentCoreMcp` construct in addition to `AgentCoreApplication`; without it, the gateway specification was ignored and the
runtime received no gateway URL.

## Source fidelity

Workshop Studio is a JavaScript application. Current source paths were resolved through its public [published build record](https://static.us-east-1.prod.workshops.aws/public/c770f35f-90a9-4e02-8985-4ef912bddb77/published.json) and [manifest](https://static.us-east-1.prod.workshops.aws/public/5311faec-4630-4bbe-b5d9-c8929d8b4661/manifest.json). Claims above come from workshop pages or fetched AWS-hosted templates. Event provisioning mechanism and `ap-southeast-2` compatibility remain explicitly undocumented.
