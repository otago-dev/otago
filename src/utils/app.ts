import { load as expo_load_env } from "@expo/env";
import { colored_log } from "./cli";
import { expo_config_get, resolve_runtime_versions, upload_all_expo_assets } from "./expo";
import { fs_exists, read_file } from "./file";

import type { Platform } from "./expo";
import type { ManifestAsset } from "./types";

const DEFAULT_NODE_ENV = "production";
const DEFAULT_EAS_PROFILE = "production";

export const load_env = async (root_dir: string) => {
  // Load environment variables
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = DEFAULT_NODE_ENV;
    colored_log("gray", `NODE_ENV not defined, using default: ${process.env.NODE_ENV}`);
  }
  // XXX: ignore env files in .gitignore or .easignore?
  expo_load_env(root_dir); // can be deactivated with EXPO_NO_DOTENV=1

  const eas_config = read_file(root_dir, "eas.json");
  if (eas_config) {
    if (!process.env.EAS_PROFILE) {
      process.env.EAS_PROFILE = DEFAULT_EAS_PROFILE;
      colored_log("gray", `EAS_PROFILE not defined, using default: ${process.env.EAS_PROFILE}`);
    }

    const { build } = JSON.parse(eas_config);
    const eas_profile = build?.[process.env.EAS_PROFILE];
    if (!eas_profile) {
      colored_log("yellow", `EAS_PROFILE: ${process.env.EAS_PROFILE} not found in eas.json`);
    } else if (eas_profile.env) {
      colored_log("gray", `env: load eas.json[${process.env.EAS_PROFILE}].env`);
      const eas_envs: string[] = [];
      Object.entries(eas_profile.env).forEach(([key, value]) => {
        if (!process.env[key]) {
          process.env[key] = value as string;
          eas_envs.push(key);
        }
      });
      if (eas_envs.length > 0) {
        colored_log("gray", `env: export ${eas_envs.join(", ")}`);
      }
    }
  }
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
    extra: { expoClient: exp },
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
