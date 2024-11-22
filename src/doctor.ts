import { get_project } from "./utils/api";
import { colored_log, step_spinner } from "./utils/cli";
import { expo_config_get, get_default_runtime_version_config, is_supported_platform } from "./utils/expo";
import { fs_exists, read_file } from "./utils/file";

const ROOT_DIR = ".";

export default async ({ project: otago_project_slug, key: otago_api_key }: { project: string; key: string }) => {
  let step;

  // Get project
  const project = await get_project(otago_project_slug, otago_api_key);

  // Get expo-updates config
  const config = expo_config_get(ROOT_DIR);
  const expo_config = config.exp;
  const platforms = expo_config.platforms?.filter(is_supported_platform) || [];

  // Display if config is valid or tips to fix it

  step = step_spinner(`Detected platforms: ${platforms.join(", ")}`);
  if (platforms.length > 0) {
    step.succeed();
  } else {
    step.fail();
    colored_log(
      "red",
      `No platforms detected. There is something wrong with your expo config, have you installed expo modules? See https://docs.expo.dev/bare/installing-expo-modules/`,
    );
    process.exit(1);
  }

  step = step_spinner("Check expo-updates dependency");
  const has_expo_updates = Boolean(
    config.pkg.dependencies?.["expo-updates"] || config.pkg.devDependencies?.["expo-updates"],
  );
  if (has_expo_updates) {
    step.succeed();
  } else {
    step.fail();
    colored_log(
      "yellow",
      `Dependency "expo-updates" is missing. Please add it to your package.json:

npx expo install expo-updates
`,
    );
  }

  step = step_spinner("Check runtime version");
  const has_runtime_version = Boolean(expo_config.runtimeVersion);
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
    "runtimeVersion": ${JSON.stringify(get_default_runtime_version_config(config))},
    ...
  }
}
`,
    );
  }

  step = step_spinner("Check update URL");
  const has_update_url = expo_config.updates?.url === project.manifest_url;
  if (has_update_url) {
    step.succeed();
  } else {
    step.fail();
    colored_log(
      "yellow",
      expo_config.updates?.url
        ? `Update URL mismatch:
  - Expected: ${project.manifest_url}
  - Got:      ${expo_config.updates!.url}

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

  if (!has_expo_updates || !has_runtime_version || !has_update_url) {
    process.exit(1);
  }

  for (const platform of platforms) {
    step = step_spinner(`Check native config for ${platform}`);

    const fail_message = `We detected a local '${platform}' folder.\n- If you use expo to build, run 'expo prebuild' locally.\n- If not, ensure you have followed https://docs.expo.dev/bare/installing-updates/.`;

    if (fs_exists(ROOT_DIR, platform)) {
      if (platform === "android") {
        const android_build_gradle = read_file(ROOT_DIR, "android/app/build.gradle");
        const has_js_engine = android_build_gradle && android_build_gradle.includes("expo.jsEngine");

        const android_manifest = read_file(ROOT_DIR, "android/app/src/main/AndroidManifest.xml");
        const has_runtime_version = android_manifest && android_manifest.includes("EXPO_RUNTIME_VERSION");
        const has_otago_manifest_url = android_manifest && android_manifest.includes(project.manifest_url);
        const has_use_cleartext_traffic =
          android_manifest && android_manifest.includes(`android:usesCleartextTraffic="true"`);

        if (
          expo_config?.extra?.eas ||
          (has_js_engine && has_runtime_version && has_otago_manifest_url && has_use_cleartext_traffic)
        ) {
          step.succeed();
        } else {
          step.end();
          colored_log("cyan", fail_message);
        }
      } else if (platform === "ios") {
        const ios_podfile = read_file(ROOT_DIR, "ios/Podfile");
        const ios_podfile_properties = read_file(ROOT_DIR, "ios/Podfile.properties.json");
        const has_js_engine =
          ios_podfile &&
          ios_podfile_properties &&
          ios_podfile.includes("expo.jsEngine") &&
          ios_podfile_properties.includes("expo.jsEngine");

        const ios_plist_path = `ios/${expo_config.name.replace(/[^a-zA-Z0-9]/g, "")}/Supporting/Expo.plist`;
        const ios_plist = read_file(ROOT_DIR, ios_plist_path);
        const has_runtime_version = ios_plist && ios_plist.includes("EXUpdatesRuntimeVersion");
        const has_otago_manifest_url = ios_plist && ios_plist.includes(project.manifest_url);

        if (expo_config?.extra?.eas || (has_js_engine && has_runtime_version && has_otago_manifest_url)) {
          step.succeed();
        } else {
          step.end();
          colored_log("cyan", fail_message);
        }
      }
    } else {
      step.succeed();
    }
  }

  step = step_spinner(`Check code signing configuration`);
  if (expo_config.updates?.codeSigningCertificate) {
    step.succeed();
  } else if (expo_config.updates && !expo_config.updates.codeSigningCertificate) {
    step.end();
    colored_log(
      "cyan",
      "We recommend signing code updates for security. See https://otago.dev/docs#how-to-sign-deployments for more information.",
    );
  }

  colored_log(
    "magenta",
    "\n✓ Congratulations, your app is now configured for OTA updates!\n⚠ Note that you need to build a version (with all env vars) and publish it so you can send your first code push.",
  );
};
