import { create_project_deployment, send_deployment_manifest } from "./utils/api";
import { extract_app_config, get_app_manifest, get_app_type, upload_all_assets } from "./utils/app";
import { step_spinner } from "./utils/cli";
import { get_current_git_version } from "./utils/git";

const ROOT_DIR = ".";

export default async ({ project: otago_project_ref, key: otago_api_key }: { project: string; key: string }) => {
  let step;

  const app_type = await get_app_type();
  const config = extract_app_config(app_type, ROOT_DIR);

  // TODO: Bundle assets
  // TODO: inline env vars from --eas-profile
  // step = step_spinner("Bundle assets");
  // step.succeed();

  // Create project deployment
  const { deployment_id, deploy_base_url } = await create_project_deployment(otago_project_ref, otago_api_key, {
    runtime_version: config.runtime_version,
    commit_version: await get_current_git_version(ROOT_DIR),
    config,
  });

  // Upload assets
  step = step_spinner("Upload assets");
  const asset_manifest = await upload_all_assets(app_type, otago_api_key, otago_project_ref, ROOT_DIR);
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
    otago_project_id: otago_project_ref,
    otago_api_key,
    otago_deploy_base_url: deploy_base_url,
  });

  if (ok) {
    step.succeed();
  } else {
    step.fail();
    throw new Error(`otago::deployments: ${status} ${statusText}`);
  }
};
