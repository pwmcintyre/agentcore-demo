export interface NetworkConfig {
  vpcIdExport: string;
  privateSubnetIdExports: string[];
}

export interface EnvironmentConfig {
  account: string;
  region: string;
  stackName: string;
  network: NetworkConfig;
}
