export interface RawajBuildInfo {
  commitSha: string;
  branch: string;
  environment: string;
  target: string;
  builtAt: string;
  deploymentUrl: string;
  provider: string;
}

declare const __RAWAJ_BUILD_INFO__: RawajBuildInfo;

export const rawajBuildInfo = __RAWAJ_BUILD_INFO__;
