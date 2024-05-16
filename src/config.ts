import { get_project } from "./utils/api";
import { detect_package_manager, get_app_type } from "./utils/app";
import { colored_log, step_spinner } from "./utils/cli";
import { expo_config_get } from "./utils/expo";

const ROOT_DIR = ".";

export default async ({ project: otago_project_slug, key: otago_api_key }: { project: string; key: string }) => {
  let step;

  // Get project
  const project = await get_project(otago_project_slug, otago_api_key);

  // Set environment variables
  process.env.OTAGO_PROJECT = otago_project_slug;
  process.env.EXPO_UPDATE_URL = project.manifest_url;

  // Get expo-updates config
  const app_type = await get_app_type(ROOT_DIR);
  const config = expo_config_get(ROOT_DIR);
  const expoConfig = config.exp;

  // Display if config is valid or tips to fix it

  step = step_spinner("Check expo-updates dependency");
  const has_expo_updates = Boolean(
    config.pkg.dependencies?.["expo-updates"] || config.pkg.devDependencies?.["expo-updates"],
  );
  if (has_expo_updates) {
    step.succeed();
  } else {
    step.fail();
    const { add_command } = await detect_package_manager(ROOT_DIR);
    colored_log(
      "yellow",
      `Dependency "expo-updates" is missing. Please add it to your package.json:

${add_command} expo-updates
`,
    );
  }

  step = step_spinner(`Check native config`);
  if (app_type === "expo") {
    step.succeed();
  } else {
    // TODO: if react-native, check https://docs.expo.dev/bare/installing-updates/
    step.succeed();
  }

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
    "runtimeVersion": ${app_type === "expo" ? `{ policy: "sdkVersion" }` : `"1.0.0"`},
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
