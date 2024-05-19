import { load as expo_load_env } from "@expo/env";
import { expo_config_get, resolve_runtime_versions, upload_all_expo_assets } from "./expo";
import { fs_exists } from "./file";

import type { Platform } from "./expo";
import type { ManifestAsset } from "./types";

export const load_env = async (...params: Parameters<typeof expo_load_env>) => {
  expo_load_env(...params);
};

export const extract_app_config = async (
  root_dir: string,
  config: ReturnType<typeof expo_config_get>,
  platforms: Platform[],
) => {
  const { exp } = config;

  const runtime_versions = await resolve_runtime_versions(root_dir, exp, platforms);

  return {
    name: exp.name,
    platforms: exp.platforms,
    icon: exp.android?.icon || exp.ios?.icon || exp.icon || null,
    android_package: exp.android?.package,
    ios_package: exp.ios?.bundleIdentifier,
    runtime_versions,
    version: exp.version,
    scheme: Array.isArray(exp.scheme) ? exp.scheme[0] : exp.scheme,
    extra: { expoConfig: exp },
  };
};

export const upload_all_assets = async (
  platforms: Platform[],
  otago_api_key: string,
  project_ref: string,
  root_dir: string,
) => {
  return upload_all_expo_assets({ platforms, otago_api_key, project_ref, root_dir });
};

export const get_app_manifest = ({
  id,
  asset_uploaded,
  runtime_version,
  extra,
}: {
  id: string;
  asset_uploaded: { bundle: ManifestAsset; assets: ManifestAsset[] };
  runtime_version: string;
  extra: Record<string, unknown>;
}) => {
  return {
    id,
    createdAt: new Date().toISOString(),
    runtimeVersion: runtime_version,
    launchAsset: asset_uploaded.bundle,
    assets: asset_uploaded.assets,
    extra,
    metadata: {},
  };
};

export const detect_package_manager = async (root_dir: string) => {
  if (fs_exists(root_dir, "yarn.lock")) return { pm: "yarn", add_command: "yarn add" };
  if (fs_exists(root_dir, "pnpm-lock.yaml")) return { pm: "pnpm", add_command: "pnpm add" };
  if (fs_exists(root_dir, "bun.lockb")) return { pm: "bun", add_command: "bun add" };
  if (fs_exists(root_dir, "package-lock.json")) return { pm: "npm", add_command: "npm install --save" };
  return { pm: null, add_command: "npm install --save" };
};
