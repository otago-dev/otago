import { getConfig, GetConfigOptions } from "@expo/config";
import { Updates } from "@expo/config-plugins";
import * as Fingerprint from "@expo/fingerprint";
import fs from "fs";
import path from "path";
import { upload_deployment_asset } from "./api";

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

export const expo_config_get = (root_dir: string, options: GetConfigOptions = {}) => {
  const expo_root_dir = path.resolve(root_dir);
  return getConfig(expo_root_dir, {
    skipSDKVersionRequirement: true,
    isPublicConfig: false,
    ...options,
  });
};

export const resolve_runtime_versions = async (
  root_dir: string,
  expo_config: ReturnType<typeof expo_config_get>["exp"],
) => {
  const resolve_runtime_version = async (platform: Platform) => {
    const runtime_version = await Updates.getRuntimeVersionAsync(
      root_dir,
      { ...expo_config, runtimeVersion: expo_config.runtimeVersion ?? { policy: "sdkVersion" } },
      platform,
    );
    return runtime_version === Updates.FINGERPRINT_RUNTIME_VERSION_SENTINEL
      ? (await Fingerprint.createFingerprintAsync(root_dir)).hash
      : runtime_version;
  };

  return {
    android: await resolve_runtime_version("android"),
    ios: await resolve_runtime_version("ios"),
  };
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
  otago_api_key,
  project_ref,
  root_dir,
}: {
  otago_api_key: string;
  project_ref: string;
  root_dir: string;
}) => {
  const { fileMetadata }: EXPO_METADATA_JSON = JSON.parse(
    fs.readFileSync(path.resolve(root_dir, `./dist/metadata.json`)).toString(),
  );

  const files_ios_uploading = fileMetadata.ios
    ? expo_asset_upload_plaform({ otago_api_key, project_ref, platform_files: fileMetadata.ios, root_dir })
    : Promise.resolve([]);
  const files_android_uploading = fileMetadata.android
    ? expo_asset_upload_plaform({ otago_api_key, project_ref, platform_files: fileMetadata.android, root_dir })
    : Promise.resolve([]);

  // FIXME: concurrency error between ios and android assets
  // const [files_ios, files_android] = await Promise.all([files_ios_uploading, files_android_uploading]);
  const files_ios = await files_ios_uploading;
  const files_android = await files_android_uploading;

  return {
    ios: fileMetadata.ios
      ? {
          bundle: [files_ios[0]].map(({ is_newly_uploaded, ...asset }) => asset)[0],
          assets: files_ios.slice(1).map(({ is_newly_uploaded, ...asset }) => asset),
        }
      : undefined,
    android: fileMetadata.android
      ? {
          bundle: [files_android[0]].map(({ is_newly_uploaded, ...asset }) => asset)[0],
          assets: files_android.slice(1).map(({ is_newly_uploaded, ...asset }) => asset),
        }
      : undefined,

    asset_infos: files_ios.concat(files_android).map((file) => ({
      key: file.key,
      is_newly_uploaded: file.is_newly_uploaded,
    })),
  };
};
