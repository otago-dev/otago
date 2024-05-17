import { get_project } from "./utils/api";
import { detect_package_manager } from "./utils/app";
import { colored_log, step_spinner } from "./utils/cli";
import { expo_config_get } from "./utils/expo";

const ROOT_DIR = ".";

export default async ({ project: otago_project_slug, key: otago_api_key }: { project: string; key: string }) => {
  let step;

  // Get project
  const project = await get_project(otago_project_slug, otago_api_key);

  // Set environment variables
  process.env.OTAGO_PROJECT = otago_project_slug;
  process.env.OTAGO_UPDATE_URL = project.manifest_url;

  // Get expo-updates config
  const config = expo_config_get(ROOT_DIR);
  const expoConfig = config.exp;

  // Display if config is valid or tips to fix it

  step = step_spinner(`Detected platforms: ${expoConfig.platforms?.filter((p) => p !== "web").join(", ")}`);
  if (expoConfig.platforms && expoConfig.platforms?.length > 0) {
    step.succeed();
  } else {
    step.fail();
    colored_log(
      "red",
      `No platforms detected. There is something wrong with your expo config, have you installed expo modules? See https://docs.expo.dev/bare/installing-expo-modules/`,
    );
    return;
  }

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
  // https://docs.expo.dev/bare/installing-updates/
  // TODO: if android, check manifest
  // TODO: if ios, check Info.plist
  // TODO: if !android && !ios, check config.exp.(runtimeVersion & updates)...
  step.succeed();

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
      expoConfig.updates?.url
        ? `Update URL mismatch:
  - Expected: ${project.manifest_url}
  - Got:      ${expoConfig.updates.url}

Note: if you use multiple environments, you need a dynamic config file:

# app.config.js
{
  "expo": {
    "updates": {
      "url": process.env.OTAGO_UPDATE_URL,
      ...
    }
  }
}
`
        : `Update URL is missing. Add it to your app.json or app.config.js:

# app.json or app.config.js
{
  "expo": {
    "updates": {
      "url": "${project.manifest_url}",
      ...
    }
  }
}
`,
    );
  }

  // TODO: check updates.codeSigningCertificate
  // TODO: if !signing, propose to generate keys + notice increment runtime version
  // TODO: build (with env vars!) & store publish notice
};
