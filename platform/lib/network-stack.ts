import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

// Public contract consumed by application teams. Export names are stable even
// when this CDK app and its internal construct tree evolve independently.
const exportNames = {
  vpcId: 'platform-network:vpc-id',
  privateSubnetIds: ['platform-network:private-subnet-1-id', 'platform-network:private-subnet-2-id'],
} as const;

export class NetworkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Two private subnets give AgentCore multi-AZ placement. One shared NAT is
    // enough for this demo and provides Bedrock plus external MCP connectivity.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.42.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'application', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      ],
    });

    new CfnOutput(this, 'VpcId', { value: vpc.vpcId, exportName: exportNames.vpcId });
    vpc.privateSubnets.forEach((subnet, index) => {
      new CfnOutput(this, `PrivateSubnet${index + 1}Id`, {
        value: subnet.subnetId,
        exportName: exportNames.privateSubnetIds[index],
      });
    });
  }
}
