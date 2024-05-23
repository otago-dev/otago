import { getConfig, GetConfigOptions } from "@expo/config";
import { Updates } from "@expo/config-plugins";
import * as Fingerprint from "@expo/fingerprint";
import path from "path";
import semver from "semver";
import { upload_deployment_asset } from "./api";
import { read_file } from "./file";

import type { ManifestAsset } from "./types";

// https://github.com/expo/eas-cli/blob/41622c0cd3b03f399c0607b08e80e11eb490618e/packages/eas-cli/src/update/configure.ts#L23-L24
export const DEFAULT_MANAGED_RUNTIME_VERSION_GTE_SDK_49 = { policy: "appVersion" } as const;
export const DEFAULT_MANAGED_RUNTIME_VERSION_LTE_SDK_48 = { policy: "sdkVersion" } as const;

export type Platform = "android" | "ios";
type EXPO_METADATA_JSON_PLATFORM = {
  bundle: string;
  assets: {
    path: string;
    ext: string;
  }[];
};
type EXPO_METADATA_JSON = {
  fileMetadata: Record<Platform, EXPO_METADATA_JSON_PLATFORM>;
};

export const supported_platforms: Platform[] = ["android", "ios"] as const;

export const is_supported_platform = (platform: string): platform is Platform =>
  supported_platforms.some((p) => p === platform);

export const expo_config_get = (root_dir: string, options: GetConfigOptions = {}) => {
  const expo_root_dir = path.resolve(root_dir);
  return getConfig(expo_root_dir, {
    skipSDKVersionRequirement: true,
    isPublicConfig: false,
    ...options,
  });
};

export const get_default_runtime_version_config = (config: ReturnType<typeof expo_config_get>) => {
  const sdk_version = config.pkg.dependencies?.expo;

  return sdk_version && semver.satisfies(sdk_version.replace(/([~^<>=]|\.(x|\*))/g, ""), ">= 49.0.0")
    ? DEFAULT_MANAGED_RUNTIME_VERSION_GTE_SDK_49
    : DEFAULT_MANAGED_RUNTIME_VERSION_LTE_SDK_48;
};

export const resolve_runtime_versions = async (
  root_dir: string,
  config: ReturnType<typeof expo_config_get>,
  platforms: Platform[],
) => {
  const expo_config = config.exp;

  const resolve_runtime_version = async (platform: Platform) => {
    const runtime_version = await Updates.getRuntimeVersionAsync(
      root_dir,
      { ...expo_config, runtimeVersion: expo_config.runtimeVersion ?? get_default_runtime_version_config(config) },
      platform,
    );
    const resolved_version =
      runtime_version === Updates.FINGERPRINT_RUNTIME_VERSION_SENTINEL
        ? (await Fingerprint.createFingerprintAsync(root_dir)).hash
        : runtime_version;

    if (!resolved_version) {
      throw new Error(`Failed to resolve runtime version for platform: ${platform}`);
    }

    return resolved_version;
  };

  return Object.fromEntries(
    await Promise.all(platforms.map(async (platform) => [platform, await resolve_runtime_version(platform)])),
  ) as Record<Platform, string>;
};

const expo_asset_upload_plaform = async ({
  root_dir,
  otago_api_key,
  project_ref,
  platform_files,
}: {
  root_dir: string;
  otago_api_key: string;
  project_ref: string;
  platform_files: EXPO_METADATA_JSON_PLATFORM;
}) => {
  const files_uploading = [
    upload_deployment_asset({
      otago_api_key,
      project_ref,
      file_absolutepath: path.resolve(root_dir, `./dist/${platform_files.bundle}`),
      file_ext: "bundle",
    }),
    ...platform_files.assets.map((file) =>
      upload_deployment_asset({
        otago_api_key,
        project_ref,
        file_absolutepath: path.resolve(root_dir, `./dist/${file.path}`),
        file_ext: file.ext,
      }),
    ),
  ];

  return Promise.all(files_uploading);
};

export const upload_all_expo_assets = async ({
  platforms,
  otago_api_key,
  project_ref,
  root_dir,
}: {
  platforms: Platform[];
  otago_api_key: string;
  project_ref: string;
  root_dir: string;
}) => {
  const metadata_file_content = read_file(root_dir, `./dist/metadata.json`);
  if (!metadata_file_content) throw new Error("./dist/metadata.json not found");

  const { fileMetadata }: EXPO_METADATA_JSON = JSON.parse(metadata_file_content);

  const files = Object.fromEntries(
    await Promise.all(
      platforms.map(async (platform) => {
        if (!fileMetadata[platform]) throw new Error(`No metadata found for platform: ${platform}`);
        return [
          platform,
          await expo_asset_upload_plaform({
            otago_api_key,
            project_ref,
            platform_files: fileMetadata[platform],
            root_dir,
          }),
        ];
      }),
    ),
  ) as Record<Platform, Awaited<ReturnType<typeof expo_asset_upload_plaform>>>;

  return {
    ...(Object.fromEntries(
      Object.entries(files).map(([platform, platform_files]) => {
        const [bundle, ...assets] = platform_files.map(({ is_newly_uploaded, ...asset }) => asset);
        return [platform, { bundle, assets }];
      }),
    ) as Record<Platform, { bundle: ManifestAsset; assets: ManifestAsset[] }>),

    asset_infos: Object.values(files)
      .flat()
      .map((file) => ({
        key: file.key,
        is_newly_uploaded: file.is_newly_uploaded,
      })),
  };
};
