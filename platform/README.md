# Platform network

Standalone CDK application representing infrastructure owned by a platform team. It has no dependency on `CustomerSupport` source or configuration.

It publishes a small CloudFormation export contract:

- `platform-network:vpc-id`
- `platform-network:private-subnet-1-id`
- `platform-network:private-subnet-2-id`

```bash
npm install
npm run build
npx cdk deploy PlatformNetwork --profile sca-pwmcintyre --require-approval never
```

Applications consume export names, not this package or its constructs.
Workload teams create their own security groups inside the exported VPC.
