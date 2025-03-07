import { create_project_deployment, get_project, send_deployment_manifest } from "./utils/api";
import { extract_app_config, get_app_manifest, upload_all_assets } from "./utils/app";
import { exec_command, step_spinner } from "./utils/cli";
import { expo_config_get, is_supported_platform, Platform } from "./utils/expo";
import { read_file } from "./utils/file";
import { get_current_git_version, get_last_git_commit_message } from "./utils/git";

import type { SigningConfig } from "./utils/signing";

const ROOT_DIR = ".";

export default async ({
  project: otago_project_slug,
  key: otago_api_key,
  privateKey: private_key_or_path,
  platforms: platforms_param,
  message: message_param,
}: {
  project: string;
  key: string;
  privateKey?: string;
  platforms: string;
  message?: string;
}) => {
  let step;

  // Get project
  const project = await get_project(otago_project_slug, otago_api_key);

  // Get expo-updates config
  const config = await expo_config_get(ROOT_DIR);
  const platforms = platforms_param.split(",").map((platform) => platform.trim());
  const supported_platform = config.exp.platforms?.filter(is_supported_platform) || [];
  const target_platforms = supported_platform.filter(
    (platform) => platforms.includes(platform) || platforms.includes("all"),
  ) as Platform[];
  if (!platforms.includes("all") && target_platforms.length !== platforms.length) {
    console.error("error: unauthorized platform. Valid platforms are:", supported_platform?.join(", ") || "none");
    process.exit(1);
  }
  const app_config = await extract_app_config(ROOT_DIR, config, target_platforms);

  let signing_config: SigningConfig | undefined;
  if (app_config.extra.expoClient.updates?.codeSigningCertificate) {
    if (!private_key_or_path) {
      console.error(
        "error: your app config contains code signing, so your private key is required: '-pk, --private-key <private_key>'",
      );
      process.exit(1);
    }

    const private_key = /\.pem$/.test(private_key_or_path)
      ? read_file(private_key_or_path)
      : private_key_or_path.replace(/\\n/g, "\n");

    if (!private_key) {
      console.error("error: private key file not found");
      process.exit(1);
    }

    signing_config = {
      private_key,
      keyid: "main",
      alg: "rsa-v1_5-sha256",
      ...app_config.extra.expoClient.updates?.codeSigningMetadata,
    };
  }

  // Create project deployment
  const unique_runtime_versions = [...new Set(Object.values(app_config.runtime_versions))];
  const message =
    (message_param && message_param.includes("$CI_COMMIT_MESSAGE")
      ? message_param.replace("$CI_COMMIT_MESSAGE", await get_last_git_commit_message(ROOT_DIR))
      : message_param) || undefined;
  const { id: deployment_id } = await create_project_deployment(otago_project_slug, otago_api_key, {
    runtime_version:
      unique_runtime_versions.length <= 1 ? unique_runtime_versions[0] : JSON.stringify(app_config.runtime_versions),
    commit_version: await get_current_git_version(ROOT_DIR),
    config: app_config,
    message: message?.slice(0, 255),
  });

  // Bundle assets
  step = step_spinner("Bundle assets");
  try {
    // Note: --clear is used to avoid cache problem if the file doesn't change but the env vars do.
    await exec_command(ROOT_DIR, "npx expo export --dump-sourcemap --clear");
    step.succeed();
  } catch (error) {
    step.fail();
    console.error(error);
    process.exit(1);
  }

  // Upload assets
  step = step_spinner("Upload assets");
  const asset_manifest = await upload_all_assets(target_platforms, otago_api_key, otago_project_slug, ROOT_DIR);
  step.succeed();

  // Generate manifest
  step = step_spinner("Generate manifest");
  const manifests = Object.fromEntries(
    target_platforms.map((platform) => [
      platform,
      get_app_manifest({
        id: deployment_id,
        asset_uploaded: asset_manifest[platform]!,
        runtime_version: app_config.runtime_versions[platform],
        extra: app_config.extra,
      }),
    ]),
  ) as Record<Platform, ReturnType<typeof get_app_manifest> | undefined>;
  step.succeed();

  // Activate deployment
  step = step_spinner("Deploy");
  const { ok, status, statusText } = await send_deployment_manifest({
    manifest_android: manifests.android,
    manifest_ios: manifests.ios,
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
    console.error(`otago::deployments: ${status} ${statusText}`);
    process.exit(1);
  }
};
