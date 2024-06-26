export type ManifestAsset = {
  url: string;
  hash: string;
  key: string;
  fileExtension: string;
  contentType: string;
};

export type Manifest = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: ManifestAsset;
  assets: ManifestAsset[];
  metadata: Record<string, unknown>;
  extra: Record<string, unknown>;
};
