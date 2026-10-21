export type DoServiceDroplet = {
  id: string;
  name: string;
  status: string;
  region: string;
  size: string;
  ipv4: string | null;
  createdAt: string;
  tags: string[];
  linkedServiceId: string | null;
  linkedHostname: string | null;
};

export type DoServiceSyncResult = {
  mock: boolean;
  fetched: number;
  linked: number;
  updated: number;
  untracked: number;
  missing: number;
  droplets: DoServiceDroplet[];
};
