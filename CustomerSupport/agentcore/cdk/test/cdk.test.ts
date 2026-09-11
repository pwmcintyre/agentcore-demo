import { AgentCoreProjectSpecSchema } from '@aws/agentcore-cdk';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CustomerSupportStack } from '../lib/customerSupport';

const network = {
  vpcIdExport: 'platform-network:vpc-id',
  privateSubnetIdExports: ['platform-network:private-subnet-1-id', 'platform-network:private-subnet-2-id'],
};

const spec = AgentCoreProjectSpecSchema.parse({
  name: 'CustomerSupport',
  version: 1,
  managedBy: 'CDK',
  runtimes: [
    {
      name: 'CustomerSupport',
      build: 'CodeZip',
      entrypoint: 'main.py',
      codeLocation: 'app/CustomerSupport/',
      runtimeVersion: 'PYTHON_3_14',
    },
  ],
  memories: [],
  credentials: [],
  evaluators: [],
  onlineEvalConfigs: [],
  configBundles: [],
  policyEngines: [],
  agentCoreGateways: [],
  knowledgeBases: [],
});

test('agent runtime imports platform network exports', () => {
  const stack = new CustomerSupportStack(new App(), 'CustomerSupport', { spec, network });
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::EC2::SecurityGroup', {
    GroupDescription: 'Outbound access for CustomerSupport AgentCore runtime',
    VpcId: { 'Fn::ImportValue': network.vpcIdExport },
  });
  template.hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
    NetworkConfiguration: {
      NetworkMode: 'VPC',
      NetworkModeConfig: {
        SecurityGroups: [{ 'Fn::GetAtt': ['RuntimeSecurityGroup', 'GroupId'] }],
        Subnets: Match.arrayWith(
          network.privateSubnetIdExports.map(name => ({ 'Fn::ImportValue': name }))
        ),
      },
    },
  });
});
