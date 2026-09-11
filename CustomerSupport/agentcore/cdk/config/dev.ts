import type { EnvironmentConfig } from './types';

export const dev = {
  account: '503528588406',
  region: 'ap-southeast-2',
  stackName: 'customer-support-agent',
  network: {
    vpcIdExport: 'platform-network:vpc-id',
    privateSubnetIdExports: ['platform-network:private-subnet-1-id', 'platform-network:private-subnet-2-id'],
  },
} satisfies EnvironmentConfig;
