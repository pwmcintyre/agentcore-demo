#!/usr/bin/env node
import { ConfigIO } from '@aws/agentcore-cdk';
import { App, Tags } from 'aws-cdk-lib';
import { dev } from '../config/dev';
import { CustomerSupportStack } from '../lib/customerSupport';

async function main(): Promise<void> {
  const app = new App({ outdir: process.env.CDK_OUTDIR ?? 'cdk.out' });
  const stage = app.node.tryGetContext('stage') ?? 'dev';
  const environments = { dev } as const;
  if (!(stage in environments)) throw new Error(`Unknown stage: ${stage}`);
  const deployment = environments[stage as keyof typeof environments];

  // AgentCore owns application schema parsing; typed stage config owns AWS
  // deployment choices that differ between environments.
  const spec = await new ConfigIO().readProjectSpec();
  Tags.of(app).add('project', spec.name);
  Tags.of(app).add('stage', stage);

  new CustomerSupportStack(app, 'CustomerSupportAgent', {
    stackName: deployment.stackName,
    env: { account: deployment.account, region: deployment.region },
    spec,
    network: deployment.network,
    description: 'CustomerSupport AgentCore runtime using platform network exports',
  });

  app.synth();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
