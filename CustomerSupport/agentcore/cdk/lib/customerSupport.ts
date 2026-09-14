import { AgentCoreApplication, AgentCoreMcp, type AgentCoreProjectSpec } from '@aws/agentcore-cdk';
import { CfnOutput, Fn, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import type { NetworkConfig } from '../config/types';

export interface CustomerSupportStackProps extends StackProps {
  spec: AgentCoreProjectSpec;
  network: NetworkConfig;
}

export class CustomerSupportStack extends Stack {
  constructor(scope: Construct, id: string, props: CustomerSupportStackProps) {
    super(scope, id, props);

    // Security groups are workload policy, so CustomerSupport owns this one.
    // L1 accepts imported VPC ID directly without pretending to own/import a
    // complete VPC construct. No ingress is needed; default egress is allowed.
    const runtimeSecurityGroup = new ec2.CfnSecurityGroup(this, 'RuntimeSecurityGroup', {
      groupDescription: 'Outbound access for CustomerSupport AgentCore runtime',
      vpcId: Fn.importValue(props.network.vpcIdExport),
    });

    // agentcore.json stays portable for `agentcore dev`. Deployment overlays the
    // platform network only after schema validation, because AgentCore's JSON
    // schema accepts literal AWS IDs but not CloudFormation tokens.
    const deploymentSpec: AgentCoreProjectSpec = {
      ...props.spec,
      runtimes: props.spec.runtimes.map(runtime => ({
        ...runtime,
        networkMode: 'VPC',
        networkConfig: {
          vpcId: Fn.importValue(props.network.vpcIdExport),
          subnets: props.network.privateSubnetIdExports.map(Fn.importValue),
          securityGroups: [runtimeSecurityGroup.attrGroupId],
        },
      })),
    };
    const application = new AgentCoreApplication(this, 'Application', { spec: deploymentSpec });
    if (deploymentSpec.agentCoreGateways.length > 0) {
      new AgentCoreMcp(this, 'Mcp', {
        projectName: deploymentSpec.name,
        mcpSpec: deploymentSpec,
        agentCoreApplication: application,
        projectTags: deploymentSpec.tags,
      });
    }
    const runtime = application.environments.get('CustomerSupport')?.runtime;
    if (!runtime) throw new Error('CustomerSupport runtime is missing from agentcore.json');

    // Stable output keys let automation register this externally deployed runtime
    // with AgentCore CLI without knowing L3-generated logical IDs.
    new CfnOutput(this, 'RuntimeArn', { value: runtime.runtimeArn });
    new CfnOutput(this, 'RuntimeId', { value: runtime.runtimeId });
    new CfnOutput(this, 'RuntimeRoleArn', { value: runtime.roleArn });
  }
}
