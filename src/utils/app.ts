import { existsSync } from "fs";
import path from "path";
import { expo_config_get, upload_all_expo_assets } from "./expo";

type APP_TYPE = "expo" | "react-native";

export const get_app_type = async (root_dir: string): Promise<APP_TYPE> => {
  const {
    pkg: { dependencies },
  } = expo_config_get(root_dir);
  return dependencies?.["expo"] ? "expo" : "react-native";
};

export const extract_app_config = (app_type: string, root_dir: string) => {
  const config = expo_config_get(root_dir);

  let runtime_version = config.exp.runtimeVersion;
  if (typeof runtime_version === "object" && "policy" in runtime_version) {
    // TODO: "nativeVersion" | "appVersion" | "fingerprint";
    if (runtime_version.policy === "sdkVersion") runtime_version = config.exp.sdkVersion;
  }
  if (!runtime_version || typeof runtime_version !== "string") {
    throw new Error("runtimeVersion is not a string");
  }

  return {
    type: app_type,
    name: config.exp.name,
    icon: config.exp.android?.icon || config.exp.ios?.icon || config.exp.icon || null,
    android_package: config.exp.android?.package,
    ios_package: config.exp.ios?.bundleIdentifier,
    runtime_version,
    version: config.exp.version,
    scheme: Array.isArray(config.exp.scheme) ? config.exp.scheme[0] : config.exp.scheme,
    extra: { expoConfig: config.exp },
  };
};

export const upload_all_assets = async (
  app_type: APP_TYPE,
  otago_api_key: string,
  project_ref: string,
  root_dir: string,
) => {
  if (app_type === "expo") {
    return upload_all_expo_assets({ otago_api_key, project_ref, root_dir });
  } else {
    // TODO: implement react-native upload_all_assets
    throw new Error("not implemented");
  }
};

export const get_app_manifest = ({
  id,
  asset_uploaded,
  runtimeVersion,
  extra,
}: {
  id: string;
  asset_uploaded: NonNullable<Awaited<ReturnType<typeof upload_all_assets>>["android"]>;
  runtimeVersion: string;
  extra: Record<string, unknown>;
}) => {
  return {
    id,
    createdAt: new Date().toISOString(),
    runtimeVersion,
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
