import { existsSync } from "fs";
import path from "path";
import { expo_config_get, resolve_runtime_versions, upload_all_expo_assets } from "./expo";

export const extract_app_config = async (root_dir: string) => {
  const { exp } = expo_config_get(root_dir);

  if (!exp.platforms) throw new Error("No platform found");

  const runtime_versions = await resolve_runtime_versions(root_dir, exp);

  return {
    name: exp.name,
    icon: exp.android?.icon || exp.ios?.icon || exp.icon || null,
    android_package: exp.android?.package,
    ios_package: exp.ios?.bundleIdentifier,
    runtime_versions,
    version: exp.version,
    scheme: Array.isArray(exp.scheme) ? exp.scheme[0] : exp.scheme,
    extra: { expoConfig: exp },
  };
};

export const upload_all_assets = async (otago_api_key: string, project_ref: string, root_dir: string) => {
  return upload_all_expo_assets({ otago_api_key, project_ref, root_dir });
};

export const get_app_manifest = ({
  id,
  asset_uploaded,
  runtime_version,
  extra,
}: {
  id: string;
  asset_uploaded: NonNullable<Awaited<ReturnType<typeof upload_all_assets>>["android"]>;
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
  if (existsSync(path.resolve(root_dir, "yarn.lock"))) return { pm: "yarn", add_command: "yarn add" };
  if (existsSync(path.resolve(root_dir, "pnpm-lock.yaml"))) return { pm: "pnpm", add_command: "pnpm add" };
  if (existsSync(path.resolve(root_dir, "bun.lockb"))) return { pm: "bun", add_command: "bun add" };
  if (existsSync(path.resolve(root_dir, "package-lock.json"))) return { pm: "npm", add_command: "npm install --save" };
  return { pm: null, add_command: "npm install --save" };
};
