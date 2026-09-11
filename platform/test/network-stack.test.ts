import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/network-stack';

test('exports two private subnets for application runtimes', () => {
  const template = Template.fromStack(new NetworkStack(new App(), 'Network'));

  template.resourceCountIs('AWS::EC2::VPC', 1);
  template.resourceCountIs('AWS::EC2::NatGateway', 1);
  template.hasOutput('VpcId', { Export: { Name: 'platform-network:vpc-id' } });
  template.hasOutput('PrivateSubnet1Id', { Export: { Name: 'platform-network:private-subnet-1-id' } });
  template.hasOutput('PrivateSubnet2Id', { Export: { Name: 'platform-network:private-subnet-2-id' } });
});
