import type { Experiment } from "./experiment";

export interface RemoteConfig {
  version: number;
  features: { report: boolean; ask: boolean; ads: boolean };
  experiments: Experiment[];
  minShell?: string;
  api: string;
}

export const DEFAULT_CONFIG: RemoteConfig = {
  version: 0,
  features: { report: false, ask: false, ads: false },
  experiments: [],
  api: "/api",
};
