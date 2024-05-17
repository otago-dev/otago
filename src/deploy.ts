import { create_project_deployment, get_project, send_deployment_manifest } from "./utils/api";
import { extract_app_config, get_app_manifest, upload_all_assets } from "./utils/app";
import { step_spinner } from "./utils/cli";
import { get_current_git_version } from "./utils/git";

const ROOT_DIR = ".";

export default async ({ project: otago_project_slug, key: otago_api_key }: { project: string; key: string }) => {
  let step;

  // Get project
  const project = await get_project(otago_project_slug, otago_api_key);

  // Set environment variables
  process.env.OTAGO_PROJECT = otago_project_slug;
  process.env.OTAGO_UPDATE_URL = project.manifest_url;

  // Get expo-updates config
  const config = extract_app_config(ROOT_DIR);

  // Create project deployment
  const { id: deployment_id } = await create_project_deployment(otago_project_slug, otago_api_key, {
    runtime_version: config.runtime_version,
    commit_version: await get_current_git_version(ROOT_DIR),
    config,
  });

  // TODO: Bundle assets (npx expo export)
  // TODO: inline env vars from --eas-profile?
  // step = step_spinner("Bundle assets");
  // step.succeed();

  // Upload assets
  step = step_spinner("Upload assets");
  const asset_manifest = await upload_all_assets(otago_api_key, otago_project_slug, ROOT_DIR);
  step.succeed();

  // Generate manifest
  step = step_spinner("Generate manifest");
  const manifest_android = asset_manifest.android
    ? get_app_manifest({
        id: deployment_id,
        asset_uploaded: asset_manifest.android,
        runtimeVersion: config.runtime_version,
        extra: config.extra,
      })
    : undefined;
  const manifest_ios = asset_manifest.ios
    ? get_app_manifest({
        id: deployment_id,
        asset_uploaded: asset_manifest.ios,
        runtimeVersion: config.runtime_version,
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
  });

  if (ok) {
    step.succeed();
  } else {
    step.fail();
    throw new Error(`otago::deployments: ${status} ${statusText}`);
  }
};
