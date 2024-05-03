// npx otago deploy msjs-test --key otago-11341fb2a6932464fac4939662912f532ef4 [--eas-profile production]

import path from "path";
import { asset_upload } from "./asset";

const api_key = "otago-11341fb2a6932464fac4939662912f532ef4";
const ROOT_DIR = ".";
const DIST_DIR_ABSOLUTE = path.resolve(ROOT_DIR, "./dist");

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

type ManifestAsset = {
  url: string;
  hash: string;
  key: string;
  fileExtension: string;
  contentType: string;
};
type Manifest = {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: ManifestAsset;
  assets: ManifestAsset[];
  metadata: {};
  extra: Record<string, any>;
};

const expo_asset_upload_plaform = async ({
  otago_api_key,
  platform_files,
}: {
  otago_api_key: string;
  platform_files: EXPO_METADATA_JSON_PLATFORM;
}) => {
  const files_uploading = [
    asset_upload({
      otago_api_key,
      file_absolutepath: path.resolve(ROOT_DIR, `./dist/${platform_files.bundle}`),
      file_ext: "bundle",
    }),
    ...platform_files.assets.map((file) =>
      asset_upload({
        otago_api_key,
        file_absolutepath: path.resolve(ROOT_DIR, `./dist/${file.path}`),
        file_ext: file.ext,
      }),
    ),
  ];

  return Promise.all(files_uploading);
};

const expo_asset_upload_all = async (otago_api_key: string) => {
  const { fileMetadata }: EXPO_METADATA_JSON = require(path.resolve(ROOT_DIR, `./dist/metadata.json`));

  const files_ios_uploading = fileMetadata.ios
    ? expo_asset_upload_plaform({ otago_api_key, platform_files: fileMetadata.ios })
    : Promise.resolve([]);
  const files_android_uploading = fileMetadata.android
    ? expo_asset_upload_plaform({ otago_api_key, platform_files: fileMetadata.android })
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

const asset_upload_all = async (otago_api_key: string) => {
  return expo_asset_upload_all(otago_api_key);
};

const send_manifest = async ({
  manifest_android,
  manifest_ios,
  otago_deployment_id,
  otago_project_id,
  otago_api_key,
}: {
  manifest_android: Manifest | undefined; // used for TS checking
  manifest_ios: Manifest | undefined;
  otago_deployment_id: string;
  otago_project_id: string;
  otago_api_key: string;
}) => {
  return fetch(`http://localhost:3000/api/projects/${otago_project_id}/deployments/${otago_deployment_id}/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": otago_api_key,
    },
    body: JSON.stringify({
      android: manifest_android ? { manifest: manifest_android, signature: null } : undefined,
      ios: manifest_ios ? { manifest: manifest_ios, signature: null } : undefined,
    }),
  });
};

const get_manifest = ({
  id,
  asset_uploaded,
  runtimeVersion,
  extra,
}: {
  id: string;
  asset_uploaded: NonNullable<Awaited<ReturnType<typeof asset_upload_all>>["android"]>;
  runtimeVersion: string;
  extra: Record<string, any>;
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

const expo_config_generate = () => {
  return {
    name: "MardiSoirJeSors",
    slug: "msjs",
    scheme: "msjs",
    owner: "devanco",
    runtimeVersion: "sdk-50.v-3",
    version: "3.0.0",
    updates: {
      url: "https://lemur-stirred-amazingly.ngrok-free.app/projects/a692d586-fd06-40be-81c2-5a53390936f4/manifest",
    },
    platforms: ["ios", "android"],
    orientation: "portrait",
    icon: "./assets/images/ico_android.png",
    primaryColor: "#380066",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "cover",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    plugins: ["expo-router"],
    experiments: { typedRoutes: true },
    extra: {
      eas: { projectId: "a692d586-fd06-40be-81c2-5a53390936f4" },
      router: { origin: false },
    },
    androidStatusBar: { barStyle: "light-content" },
    ios: { supportsTablet: false, icon: "./assets/images/ico_ios.png" },
    android: {
      package: "com.devanco.msjs",
      icon: "./assets/images/ico_android.png",
      adaptiveIcon: {
        foregroundImage: "./assets/images/ico_android_foreground.png",
        backgroundColor: "#380066",
      },
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.devanco.msjs",
    },
    sdkVersion: "50.0.0",
  };
};

const expo_main = async () => {
  // calcul de la expo_config
  const expo_config = expo_config_generate();
  const config_app_runtime = expo_config.runtimeVersion;
  const config_manifest_extra = { expoClient: expo_config };

  // create deployment
  const res_deployment = await fetch("http://localhost:3000/api/projects/msjs-test/deployments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": api_key,
    },
    body: JSON.stringify({
      runtime_version: config_app_runtime,
      commit_version: "gitv42",
      config: { type: "expo", value: expo_config },
    }),
  });
  const { deployment_id } = (await res_deployment.json()) as { deployment_id: string };

  // upload assets
  const asset_manifest = await asset_upload_all(api_key);
  console.log("asset_manifest", asset_manifest.asset_infos);

  // generate manifest
  const manifest_android = asset_manifest.android
    ? get_manifest({
        id: deployment_id,
        asset_uploaded: asset_manifest.android,
        runtimeVersion: config_app_runtime,
        extra: config_manifest_extra,
      })
    : undefined;
  const manifest_ios = asset_manifest.ios
    ? get_manifest({
        id: deployment_id,
        asset_uploaded: asset_manifest.ios,
        runtimeVersion: config_app_runtime,
        extra: config_manifest_extra,
      })
    : undefined;

  //TODO signature

  // activate deployment
  const res = await send_manifest({
    manifest_android,
    manifest_ios,
    otago_deployment_id: deployment_id,
    otago_project_id: "msjs-test",
    otago_api_key: api_key,
  });

  if (!res.ok) {
    throw new Error("otago::deployments : " + res.statusText);
  }

  console.log("youpi !!");
};

expo_main();
