#!/usr/bin/env node
import { App, Tags } from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';

// Platform pipeline selects account and region through normal CDK credentials.
// No CustomerSupport files or deployment targets are read here.
const app = new App({ outdir: process.env.CDK_OUTDIR ?? 'cdk.out' });
const stack = new NetworkStack(app, 'PlatformNetwork', {
  stackName: 'platform-network',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'Shared platform network exported for application teams',
});
Tags.of(stack).add('owner', 'platform');

app.synth();
