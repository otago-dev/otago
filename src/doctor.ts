import { get_project } from "./utils/api";
import { detect_package_manager } from "./utils/app";
import { colored_log, step_spinner } from "./utils/cli";
import { expo_config_get, supported_platforms } from "./utils/expo";
import { fs_exists, read_file } from "./utils/file";

const ROOT_DIR = ".";

export default async ({ project: otago_project_slug, key: otago_api_key }: { project: string; key: string }) => {
  let step;
  let success = true;

  // Get project
  const project = await get_project(otago_project_slug, otago_api_key);

  // Set environment variables
  process.env.OTAGO_PROJECT = otago_project_slug;
  process.env.OTAGO_UPDATE_URL = project.manifest_url;

  // Get expo-updates config
  const config = expo_config_get(ROOT_DIR);
  const expo_config = config.exp;
  const platforms = expo_config.platforms?.filter((platform) => supported_platforms.some((p) => p === platform)) || [];

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
    "runtimeVersion": { policy: "sdkVersion" },
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
    return;
  }

  for (const platform of platforms) {
    step = step_spinner(`Check native config for ${platform}`);
    if (fs_exists(ROOT_DIR, platform)) {
      // https://docs.expo.dev/bare/installing-updates/
      if (platform === "android") {
        const android_build_gradle = read_file(ROOT_DIR, "android/app/build.gradle");
        const has_js_engine = android_build_gradle && android_build_gradle.includes("expo.jsEngine");

        const android_manifest = read_file(ROOT_DIR, "android/app/src/main/AndroidManifest.xml");
        const has_runtime_version = android_manifest && android_manifest.includes("EXPO_RUNTIME_VERSION");
        const has_otago_manifest_url = android_manifest && android_manifest.includes(project.manifest_url);
        const has_use_cleartext_traffic =
          android_manifest && android_manifest.includes(`android:usesCleartextTraffic="true"`);

        if (has_js_engine && has_runtime_version && has_otago_manifest_url && has_use_cleartext_traffic) {
          step.succeed();
        } else {
          step.fail();
          success = false;

          if (!has_js_engine) {
            colored_log(
              "yellow",
              `Missing JS engine configuration. Add the following to your build.gradle:

# android/app/build.gradle (before android block)
// Override \`hermesEnabled\` by \`expo.jsEngine\`
ext {
  hermesEnabled = (findProperty('expo.jsEngine') ?: "hermes") == "hermes"
}
`,
            );
          }
          if (!has_runtime_version || !has_otago_manifest_url) {
            colored_log(
              "yellow",
              `Missing updates module configuration. Add the following to your AndroidManifest.xml:

# android/app/src/main/AndroidManifest.xml
<application ...>
  <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
  <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="0"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="${project.manifest_url}"/>
  ...
`,
            );
          }
          if (!has_use_cleartext_traffic) {
            colored_log(
              "yellow",
              `Missing usesCleartextTraffic configuration. Add the following to your AndroidManifest.xml:

# android/app/src/main/AndroidManifest.xml
<application ... android:usesCleartextTraffic="true">
`,
            );
          }
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

        if (has_js_engine && has_runtime_version && has_otago_manifest_url) {
          step.succeed();
        } else {
          step.fail();
          success = false;

          if (!has_js_engine) {
            colored_log(
              "yellow",
              `Missing JS engine configuration. Add the following to your Podfile config:

# ios/Podfile.properties.json
{
  "expo.jsEngine": "hermes"
}

# ios/Podfile
require 'json'
podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}

And replace ":hermes_enabled: ..." with:
:hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes',
`,
            );
          }
          if (!has_runtime_version || !has_otago_manifest_url) {
            colored_log(
              "yellow",
              `Missing updates module configuration. Add the following to Supporting/Expo.plist (replace with the right runtime version):

# ${ios_plist_path}
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>EXUpdatesCheckOnLaunch</key>
    <string>ALWAYS</string>
    <key>EXUpdatesEnabled</key>
    <true/>
    <key>EXUpdatesLaunchWaitMs</key>
    <integer>0</integer>
    <key>EXUpdatesRuntimeVersion</key>
    <string>1.0.0</string>
    <key>EXUpdatesURL</key>
    <string>${project.manifest_url}</string>
  </dict>
</plist>
`,
            );
          }
        }
      }
    } else {
      step.succeed();
    }
  }

  if (success) {
    if (expo_config.updates?.codeSigningCertificate) {
      step_spinner(`Code signing configured`).succeed();
    } else if (expo_config.updates && !expo_config.updates.codeSigningCertificate) {
      colored_log(
        "cyan",
        "\nⓘ  We recommend signing code updates. See https://otago.dev/docs#how-to-sign-deployments for more information.",
      );
    }
    // TODO: [magenta] build (with env vars!) & store publish notice
  }
};
