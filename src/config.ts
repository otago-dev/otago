import { get_project } from "./utils/api";
import { extract_app_config, get_app_type } from "./utils/app";
import { colored_log, step_spinner } from "./utils/cli";

const ROOT_DIR = ".";

export default async ({ project: otago_project_slug, key: otago_api_key }: { project: string; key: string }) => {
  let step;

  // Get project
  const project = await get_project(otago_project_slug, otago_api_key);

  // Set environment variables
  process.env.OTAGO_PROJECT = otago_project_slug;
  process.env.EXPO_UPDATE_URL = project.manifest_url;

  // Get expo-updates config
  const app_type = await get_app_type();
  const config = extract_app_config(app_type, ROOT_DIR);
  // TODO: handle if config doesn't exist
  const expoConfig = config.extra.expoConfig;

  // Display if config is valid or tips to fix it

  // TODO: check expo-updates dependency

  step = step_spinner("Check runtime version");
  const has_runtime_version = Boolean(expoConfig.runtimeVersion);
  if (has_runtime_version) {
    step.succeed();
  } else {
    step.fail();
    colored_log(
      "yellow",
      `Runtime version is missing. Add it to your app.json or app.config.js:

# app.json or app.config.js
{
  "expo": {
    "runtimeVersion": { policy: "sdkVersion" },
    ...
  }
}
`,
    );
  }

  step = step_spinner("Check update URL");
  const has_update_url = expoConfig.updates?.url === project.manifest_url;
  if (has_update_url) {
    step.succeed();
  } else {
    step.fail();
    colored_log(
      "yellow",
      `Runtime version is missing. Add it to your app.json or app.config.js:

# app.json or app.config.js
{
  "expo": {
    "updates": {
      "url": "${project.manifest_url}",
      // Or if you use multiple environments:
      // "url": process.env.OTAGO_PROJECT === "${otago_project_slug}" ? "${project.manifest_url}" : ...,
      ...
    }
  }
}
`,
    );
  }

  // TODO: check updates.codeSigningCertificate
  // TODO: build & publish notice
};
