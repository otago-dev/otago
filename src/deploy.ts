import { create_project_deployment, get_project, send_deployment_manifest } from "./utils/api";
import { extract_app_config, get_app_manifest, upload_all_assets } from "./utils/app";
import { step_spinner } from "./utils/cli";
import { read_file } from "./utils/file";
import { get_current_git_version } from "./utils/git";

import type { SigningConfig } from "./utils/signing";

const ROOT_DIR = ".";

export default async ({
  project: otago_project_slug,
  key: otago_api_key,
  privateKey: private_key_or_path,
}: {
  project: string;
  key: string;
  privateKey?: string;
}) => {
  let step;

  // Get project
  const project = await get_project(otago_project_slug, otago_api_key);

  // Set environment variables
  process.env.OTAGO_PROJECT = otago_project_slug;
  process.env.OTAGO_UPDATE_URL = project.manifest_url;

  // Get expo-updates config
  const config = await extract_app_config(ROOT_DIR);

  let signing_config: SigningConfig | undefined;
  if (config.extra.expoConfig.updates?.codeSigningCertificate) {
    if (!private_key_or_path) {
      console.error("error: required option '-pk, --private-key <private_key>' not specified");
      return;
    }

    const private_key = /\.pem$/.test(private_key_or_path)
      ? read_file(private_key_or_path)
      : private_key_or_path.replace(/\\n/g, "\n");

    if (!private_key) {
      console.error("error: private key file not found");
      return;
    }

    signing_config = {
      private_key,
      keyid: "main",
      alg: "rsa-v1_5-sha256",
      ...config.extra.expoConfig.updates?.codeSigningMetadata,
    };
  }

  // Create project deployment
  const unique_runtime_versions = [...new Set(Object.values(config.runtime_versions))];
  const { id: deployment_id } = await create_project_deployment(otago_project_slug, otago_api_key, {
    runtime_version:
      unique_runtime_versions.length <= 1 ? unique_runtime_versions[0] : JSON.stringify(config.runtime_versions),
    commit_version: await get_current_git_version(ROOT_DIR),
    config,
  });

  // TODO: Bundle assets (npx expo export)
  // TODO: inline env vars from --eas-profile? https://docs.expo.dev/eas-update/environment-variables/
  // step = step_spinner("Bundle assets");
  // step.succeed();

  // Upload assets
  step = step_spinner("Upload assets");
  const asset_manifest = await upload_all_assets(otago_api_key, otago_project_slug, ROOT_DIR);
  step.succeed();

  // Generate manifest
  step = step_spinner("Generate manifest");
  const manifest_android =
    asset_manifest.android && config.runtime_versions.android
      ? get_app_manifest({
          id: deployment_id,
          asset_uploaded: asset_manifest.android,
          runtime_version: config.runtime_versions.android,
          extra: config.extra,
        })
      : undefined;
  const manifest_ios =
    asset_manifest.ios && config.runtime_versions.ios
      ? get_app_manifest({
          id: deployment_id,
          asset_uploaded: asset_manifest.ios,
          runtime_version: config.runtime_versions.ios,
          extra: config.extra,
        })
      : undefined;
  step.succeed();

  // Activate deployment
  step = step_spinner("Deploy");
  const { ok, status, statusText } = await send_deployment_manifest({
    manifest_android,
    manifest_ios,
    otago_deployment_id: deployment_id,
    otago_project_id: otago_project_slug,
    otago_api_key,
    otago_project_manifest_url: project.manifest_url,
    signing_config,
  });

  if (ok) {
    step.succeed();
  } else {
    step.fail();
    throw new Error(`otago::deployments: ${status} ${statusText}`);
  }
};
