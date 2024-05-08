// npx otago deploy msjs-test --key otago-11341fb2a6932464fac4939662912f532ef4 [--eas-profile production]

import { expo_asset_upload_all, expo_config_generate } from "./sdk.expo";
import execa from "execa";
import path from "path";

const api_key = "otago-11341fb2a6932464fac4939662912f532ef4";
const ROOT_DIR = ".";

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

const asset_upload_all = async (otago_api_key: string) => {
  return expo_asset_upload_all({ otago_api_key, root_dir: ROOT_DIR });
};

const manifest_signature = ({ manifest }: { manifest: Manifest }) => {
  return null;
};

const send_manifest = async ({
  manifest_android,
  manifest_ios,
  otago_deployment_id,
  otago_project_id,
  otago_api_key,
  otago_deploy_base_url,
}: {
  manifest_android: Manifest | undefined; // used for TS checking
  manifest_ios: Manifest | undefined;
  otago_deployment_id: string;
  otago_project_id: string;
  otago_api_key: string;
  otago_deploy_base_url: string;
}) => {
  const manifest_android_final = manifest_android
    ? {
        ...manifest_android,
        launchAsset: {
          ...manifest_android.launchAsset,
          url: `${otago_deploy_base_url}/manifest/launchable?manifest_id=${manifest_android.id}&platform=android`,
        },
      }
    : undefined;

  const manifest_ios_final = manifest_ios
    ? {
        ...manifest_ios,
        launchAsset: {
          ...manifest_ios.launchAsset,
          url: `${otago_deploy_base_url}/manifest/launchable?manifest_id=${manifest_ios.id}&platform=ios`,
        },
      }
    : undefined;

  //TODO signature

  return fetch(`http://localhost:3000/api/projects/${otago_project_id}/deployments/${otago_deployment_id}/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": otago_api_key,
    },
    body: JSON.stringify({
      android: manifest_android
        ? {
            launchable_url: manifest_android.launchAsset.url,
            manifest: manifest_android_final!,
            signature: manifest_signature({ manifest: manifest_android_final! }),
          }
        : undefined,
      ios: manifest_ios
        ? {
            launchable_url: manifest_ios.launchAsset.url,
            manifest: manifest_ios_final!,
            signature: manifest_signature({ manifest: manifest_ios_final! }),
          }
        : undefined,
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

const config_extract = () => {
  if ("expo" === "expo") {
    return expo_config_generate(ROOT_DIR);
  }

  throw new Error("not implemented");
};

const git_current_version = async () => {
  try {
    const { stdout } = await execa("git", ["log", "--pretty=tformat:%h", "-n1", path.resolve(ROOT_DIR)]);
    return stdout;
  } catch (e) {
    return "no_git_info";
  }
};

const expo_main = async () => {
  // calcul de la expo_config
  const config = config_extract();

  // create deployment
  const res_deployment = await fetch("http://localhost:3000/api/projects/msjs-test/deployments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": api_key,
    },
    body: JSON.stringify({
      runtime_version: config.runtime_version,
      commit_version: await git_current_version(),
      config,
    }),
  });
  const { deployment_id, deploy_base_url } = (await res_deployment.json()) as {
    deployment_id: string;
    deploy_base_url: string;
  };

  // upload assets
  const asset_manifest = await asset_upload_all(api_key);
  console.log("asset_manifest", asset_manifest.asset_infos);

  // generate manifest
  const manifest_android = asset_manifest.android
    ? get_manifest({
        id: deployment_id,
        asset_uploaded: asset_manifest.android,
        runtimeVersion: config.runtime_version,
        extra: config.extra,
      })
    : undefined;
  const manifest_ios = asset_manifest.ios
    ? get_manifest({
        id: deployment_id,
        asset_uploaded: asset_manifest.ios,
        runtimeVersion: config.runtime_version,
        extra: config.extra,
      })
    : undefined;

  // activate deployment
  const res = await send_manifest({
    manifest_android,
    manifest_ios,
    otago_deployment_id: deployment_id,
    otago_project_id: "msjs-test",
    otago_api_key: api_key,
    otago_deploy_base_url: deploy_base_url,
  });

  if (!res.ok) {
    throw new Error("otago::deployments : " + res.statusText);
  }

  console.log("youpi !!");
};

expo_main();
