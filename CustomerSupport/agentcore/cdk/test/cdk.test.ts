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
      authorizerType: 'CUSTOM_JWT',
      authorizerConfiguration: {
        customJwtAuthorizer: {
          discoveryUrl: 'https://cognito-idp.ap-southeast-2.amazonaws.com/test/.well-known/openid-configuration',
          allowedClients: ['machine-client', 'web-client'],
        },
      },
    },
  ],
  memories: [],
  credentials: [],
  evaluators: [],
  onlineEvalConfigs: [
    {
      name: 'QualityMonitor',
      agent: 'CustomerSupport',
      evaluators: ['Builtin.GoalSuccessRate', 'Builtin.Correctness', 'Builtin.ToolSelectionAccuracy'],
      samplingRate: 100,
      enableOnCreate: true,
    },
  ],
  configBundles: [],
  policyEngines: [],
  agentCoreGateways: [
    {
      name: 'my-gateway-secure',
      protocolType: 'None',
      targets: [
        {
          name: 'WarrantyCheck',
          targetType: 'lambdaFunctionArn',
          lambdaFunctionArn: {
            lambdaArn: 'arn:aws:lambda:ap-southeast-2:123456789012:function:workshop-warranty-check',
            toolSchemaFile: 'app/CustomerSupport/tool/warranty_schema.json',
          },
        },
      ],
      authorizerType: 'CUSTOM_JWT',
      authorizerConfiguration: {
        customJwtAuthorizer: {
          discoveryUrl: 'https://cognito-idp.ap-southeast-2.amazonaws.com/test/.well-known/openid-configuration',
          allowedClients: ['machine-client', 'web-client'],
        },
      },
    },
  ],
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
        Subnets: Match.arrayWith(network.privateSubnetIdExports.map(name => ({ 'Fn::ImportValue': name }))),
      },
    },
    EnvironmentVariables: Match.objectLike({
      AGENTCORE_GATEWAY_MY_GATEWAY_SECURE_URL: Match.anyValue(),
    }),
    AuthorizerConfiguration: {
      CustomJWTAuthorizer: {
        DiscoveryUrl: 'https://cognito-idp.ap-southeast-2.amazonaws.com/test/.well-known/openid-configuration',
        AllowedClients: ['machine-client', 'web-client'],
      },
    },
  });
  template.hasResourceProperties('AWS::BedrockAgentCore::Gateway', {
    AuthorizerType: 'CUSTOM_JWT',
    AuthorizerConfiguration: {
      CustomJWTAuthorizer: {
        DiscoveryUrl: 'https://cognito-idp.ap-southeast-2.amazonaws.com/test/.well-known/openid-configuration',
        AllowedClients: ['machine-client', 'web-client'],
      },
    },
  });
  template.resourceCountIs('AWS::BedrockAgentCore::Gateway', 1);
  template.resourceCountIs('AWS::BedrockAgentCore::GatewayTarget', 1);
  template.hasResourceProperties('AWS::BedrockAgentCore::OnlineEvaluationConfig', {
    OnlineEvaluationConfigName: 'CustomerSupport_QualityMonitor',
    Evaluators: [
      { EvaluatorId: 'Builtin.GoalSuccessRate' },
      { EvaluatorId: 'Builtin.Correctness' },
      { EvaluatorId: 'Builtin.ToolSelectionAccuracy' },
    ],
    ExecutionStatus: 'ENABLED',
    DataSourceConfig: {
      CloudWatchLogs: {
        LogGroupNames: [
          {
            'Fn::Join': [
              '',
              [
                '/aws/bedrock-agentcore/runtimes/',
                { 'Fn::GetAtt': ['ApplicationAgentCustomerSupportRuntimeCF96A437', 'AgentRuntimeId'] },
                '-DEFAULT',
              ],
            ],
          },
        ],
        ServiceNames: ['CustomerSupport_CustomerSupport.DEFAULT'],
      },
    },
    Rule: {
      SamplingConfig: { SamplingPercentage: 100 },
      SessionConfig: { SessionTimeoutMinutes: 5 },
    },
  });
});
