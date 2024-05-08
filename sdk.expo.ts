import { asset_upload } from "./asset";
import path from "path";
import { getConfig } from "@expo/config";

type EXPO_METADATA_JSON_PLATFORM = {
  bundle: string;
  assets: {
    path: string;
    ext: string;
  }[];
};
type EXPO_METADATA_JSON = {
  fileMetadata: {
    ios?: EXPO_METADATA_JSON_PLATFORM;
    android?: EXPO_METADATA_JSON_PLATFORM;
  };
};

const expo_asset_upload_plaform = async ({
  root_dir,
  otago_api_key,
  platform_files,
}: {
  root_dir: string;
  otago_api_key: string;
  platform_files: EXPO_METADATA_JSON_PLATFORM;
}) => {
  const files_uploading = [
    asset_upload({
      otago_api_key,
      file_absolutepath: path.resolve(root_dir, `./dist/${platform_files.bundle}`),
      file_ext: "bundle",
    }),
    ...platform_files.assets.map((file) =>
      asset_upload({
        otago_api_key,
        file_absolutepath: path.resolve(root_dir, `./dist/${file.path}`),
        file_ext: file.ext,
      }),
    ),
  ];

  return Promise.all(files_uploading);
};

export const expo_asset_upload_all = async ({
  otago_api_key,
  root_dir,
}: {
  otago_api_key: string;
  root_dir: string;
}) => {
  const { fileMetadata }: EXPO_METADATA_JSON = require(path.resolve(root_dir, `./dist/metadata.json`));

  const files_ios_uploading = fileMetadata.ios
    ? expo_asset_upload_plaform({ otago_api_key, platform_files: fileMetadata.ios, root_dir })
    : Promise.resolve([]);
  const files_android_uploading = fileMetadata.android
    ? expo_asset_upload_plaform({ otago_api_key, platform_files: fileMetadata.android, root_dir })
    : Promise.resolve([]);

  const [files_ios, files_android] = await Promise.all([files_ios_uploading, files_android_uploading]);

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

export const expo_config_generate = (root_dir: string) => {
  const expo_root_dir = path.resolve(root_dir);
  const config = getConfig(expo_root_dir, {
    skipSDKVersionRequirement: true,
    isPublicConfig: true,
  });

  if (typeof config.exp.runtimeVersion !== "string" || !config.exp.runtimeVersion) {
    // TODO : explore different cases
    throw new Error("runtimeVersion is not a string");
  }

  return {
    type: "expo" as const,
    name: config.exp.name,
    icon: config.exp.android?.icon || config.exp.ios?.icon || config.exp.icon || null,
    android_package: config.exp.android?.package,
    ios_package: config.exp.ios?.bundleIdentifier,
    runtime_version: config.exp.runtimeVersion,
    version: config.exp.version,
    scheme: Array.isArray(config.exp.scheme) ? config.exp.scheme[0] : config.exp.scheme,
    extra: { expoConfig: config.exp },
  };
};
