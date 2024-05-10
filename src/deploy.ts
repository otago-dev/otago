import { create_project_deployment, send_deployment_manifest } from "./utils/api";
import { extract_app_config, get_app_manifest, get_app_type, upload_all_assets } from "./utils/app";
import { get_current_git_version } from "./utils/git";

const ROOT_DIR = ".";

// TODO: --eas-profile production

export default async (project_ref: string, options: { key: string }) => {
  const otago_api_key = options.key;

  const app_type = await get_app_type();
  const config = extract_app_config(app_type, ROOT_DIR);

  // Create project deployment
  const { deployment_id, deploy_base_url } = await create_project_deployment(project_ref, otago_api_key, {
    runtime_version: config.runtime_version,
    commit_version: await get_current_git_version(ROOT_DIR),
    config,
  });

  // Upload assets
  const asset_manifest = await upload_all_assets(app_type, otago_api_key, project_ref, ROOT_DIR);

  // Generate manifest
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

  // Activate deployment
  const { ok, status, statusText } = await send_deployment_manifest({
    manifest_android,
    manifest_ios,
    otago_deployment_id: deployment_id,
    otago_project_id: project_ref,
    otago_api_key,
    otago_deploy_base_url: deploy_base_url,
  });

  if (!ok) throw new Error(`otago::deployments: ${status} ${statusText}`);
};
