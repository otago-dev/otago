// npx otago deploy msjs-test --key otago-11341fb2a6932464fac4939662912f532ef4 [--eas-profile production]

import execa from "execa";
import path from "path";
import type { Manifest } from "./misc";
import { expo_asset_upload_all, expo_config_generate } from "./sdk.expo";
import { sign_manifest } from "./signing";

const api_key = "otago-11341fb2a6932464fac4939662912f532ef4";
const ROOT_DIR = ".";
const SIGN_KEY_PATH = "/home/jnoleau/repo/devanco/otago/certs/code-signing-certificates/keys/rn50-private-key.pem";
// const SIGN_KEY_PATH = undefined;

const asset_upload_all = async (otago_api_key: string) => {
  return expo_asset_upload_all({ otago_api_key, root_dir: ROOT_DIR });
};

const send_manifest = async ({
  manifest_android,
  manifest_ios,
  otago_deployment_id,
  otago_project_id,
  otago_api_key,
  otago_deploy_base_url,
}: {
  manifest_android: Manifest | undefined; // used for TS checking
  manifest_ios: Manifest | undefined;
  otago_deployment_id: string;
  otago_project_id: string;
  otago_api_key: string;
  otago_deploy_base_url: string;
}) => {
  const manifest_android_final = manifest_android
    ? {
        ...manifest_android,
        launchAsset: {
          ...manifest_android.launchAsset,
          url: `${otago_deploy_base_url}/manifest/launchable?manifest_id=${manifest_android.id}&platform=android`,
        },
      }
    : undefined;

  const manifest_ios_final = manifest_ios
    ? {
        ...manifest_ios,
        launchAsset: {
          ...manifest_ios.launchAsset,
          url: `${otago_deploy_base_url}/manifest/launchable?manifest_id=${manifest_ios.id}&platform=ios`,
        },
      }
    : undefined;

  //TODO signature

  return fetch(`http://localhost:3000/api/projects/${otago_project_id}/deployments/${otago_deployment_id}/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": otago_api_key,
    },
    body: JSON.stringify({
      android: manifest_android
        ? {
            launchable_url: manifest_android.launchAsset.url,
            manifest: manifest_android_final!,
            signature: SIGN_KEY_PATH ? await sign_manifest(manifest_android_final!, SIGN_KEY_PATH) : null,
          }
        : undefined,
      ios: manifest_ios
        ? {
            launchable_url: manifest_ios.launchAsset.url,
            manifest: manifest_ios_final!,
            signature: SIGN_KEY_PATH ? await sign_manifest(manifest_ios_final!, SIGN_KEY_PATH) : null,
          }
        : undefined,
    }),
  });
};

const get_manifest = ({
  id,
  asset_uploaded,
  runtimeVersion,
  extra,
}: {
  id: string;
  asset_uploaded: NonNullable<Awaited<ReturnType<typeof asset_upload_all>>["android"]>;
  runtimeVersion: string;
  extra: Record<string, any>;
}) => {
  return {
    id,
    createdAt: new Date().toISOString(),
    runtimeVersion,
    launchAsset: asset_uploaded.bundle,
    assets: asset_uploaded.assets,
    extra,
    metadata: {},
  };
};

const config_extract = () => {
  if ("expo" === "expo") {
    return expo_config_generate(ROOT_DIR);
  }

  throw new Error("not implemented");
};

const git_current_version = async () => {
  try {
    const { stdout } = await execa("git", ["log", "--pretty=tformat:%h", "-n1", path.resolve(ROOT_DIR)]);
    return stdout;
  } catch (e) {
    return "no_git_info";
  }
};

const expo_main = async () => {
  // calcul de la expo_config
  const config = config_extract();

  // create deployment
  const res_deployment = await fetch("http://localhost:3000/api/projects/msjs-test/deployments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": api_key,
    },
    body: JSON.stringify({
      runtime_version: config.runtime_version,
      commit_version: await git_current_version(),
      config,
    }),
  });
  const { deployment_id, deploy_base_url } = (await res_deployment.json()) as {
    deployment_id: string;
    deploy_base_url: string;
  };

  // upload assets
  const asset_manifest = await asset_upload_all(api_key);
  console.log("asset_manifest", asset_manifest.asset_infos);

  // generate manifest
  const manifest_android = asset_manifest.android
    ? get_manifest({
        id: deployment_id,
        asset_uploaded: asset_manifest.android,
        runtimeVersion: config.runtime_version,
        extra: config.extra,
      })
    : undefined;
  const manifest_ios = asset_manifest.ios
    ? get_manifest({
        id: deployment_id,
        asset_uploaded: asset_manifest.ios,
        runtimeVersion: config.runtime_version,
        extra: config.extra,
      })
    : undefined;

  // activate deployment
  const res = await send_manifest({
    manifest_android,
    manifest_ios,
    otago_deployment_id: deployment_id,
    otago_project_id: "msjs-test",
    otago_api_key: api_key,
    otago_deploy_base_url: deploy_base_url,
  });

  if (!res.ok) {
    throw new Error("otago::deployments : " + res.statusText);
  }

  console.log("youpi !!");
};

const xxx = {
  id: "ae22c8bd-8044-4a65-9000-e4350d61553f",
  extra: {
    expoConfig: {
      ios: { icon: "./assets/images/ico_ios.png", supportsTablet: false },
      icon: "./assets/images/ico_android.png",
      name: "MardiSoirJeSors",
      slug: "msjs",
      extra: { eas: { projectId: "a692d586-fd06-40be-81c2-5a53390936f4" }, router: { origin: false } },
      owner: "devanco",
      scheme: "msjs",
      splash: { image: "./assets/images/splash.png", resizeMode: "cover", backgroundColor: "#ffffff" },
      android: {
        icon: "./assets/images/ico_android.png",
        package: "com.devanco.msjs",
        adaptiveIcon: { backgroundColor: "#380066", foregroundImage: "./assets/images/ico_android_foreground.png" },
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.devanco.msjs",
      },
      plugins: ["expo-router"],
      updates: {},
      version: "4.0.0",
      platforms: ["ios", "android"],
      sdkVersion: "50.0.0",
      experiments: { typedRoutes: true },
      orientation: "portrait",
      primaryColor: "#380066",
      runtimeVersion: "sdk-50.v-3",
      androidStatusBar: { barStyle: "light-content" },
      userInterfaceStyle: "automatic",
      assetBundlePatterns: ["**/*"],
    },
  },
  assets: [
    {
      key: "b06871f281fee6b241d60582ae9369b9",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/b06871f281fee6b241d60582ae9369b9",
      hash: "qljzPyOaD7AvXHpsRcBD16msmgkzNYBmlOzW1O3A1qg",
      contentType: "font/ttf",
      fileExtension: ".ttf",
    },
    {
      key: "778ffc9fe8773a878e9c30a6304784de",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/778ffc9fe8773a878e9c30a6304784de",
      hash: "i2Gkx-9w3JJ1PwSUl2SC9m_UFQ7CPfx3KrZeEDc6-lU",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "376d6a4c7f622917c39feb23671ef71d",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/376d6a4c7f622917c39feb23671ef71d",
      hash: "QJsG0VpGM-5viirUgoKq0M4zQ_TYyPfLhAhN5mrM54I",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "c79c3606a1cf168006ad3979763c7e0c",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/c79c3606a1cf168006ad3979763c7e0c",
      hash: "kGZm3WiTRq2iMs42ia3vkHtCV_obWT8DY40rlJf2SIQ",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "02bc1fa7c0313217bde2d65ccbff40c9",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/02bc1fa7c0313217bde2d65ccbff40c9",
      hash: "_6fuRbdkBbpzkhSVAI99aMneY5X0tpQdsGNGX244IyA",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "35ba0eaec5a4f5ed12ca16fabeae451d",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/35ba0eaec5a4f5ed12ca16fabeae451d",
      hash: "hM9es7ICUPaeDkczvrTaX0F_BoKJKlrRteYlcHU8IbE",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "5223c8d9b0d08b82a5670fb5f71faf78",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/5223c8d9b0d08b82a5670fb5f71faf78",
      hash: "LJXowmdeeZM1_QBGuwfb2gbLfs_1HtN5IsYwnWGcxNM",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "563d5e3294b67811d0a1aede6f601e30",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/563d5e3294b67811d0a1aede6f601e30",
      hash: "M3Rw55duRh-sGFMCjFkHlEfvd8GivSJoVoQJXvBNFBQ",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "b6c297a501e289394b0bc5dc69c265e6",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/b6c297a501e289394b0bc5dc69c265e6",
      hash: "nUUUlHIjdOeMNjvKmhYS7NKv-SWftJkSFV5rriaFsqU",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "5974eb3e1c5314e8d5a822702d7d0740",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/5974eb3e1c5314e8d5a822702d7d0740",
      hash: "rCcPeBVDZeEAZAH3Fdb9k8RII3FIu_PvDqfrDAsjUUQ",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "9d9c5644f55c2f6e4b7f247c378b2fe9",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/9d9c5644f55c2f6e4b7f247c378b2fe9",
      hash: "vahwd_zNPKVOz_ZK9r9JovUCDO-kqrkSHLpNktCjAEs",
      contentType: "image/png",
      fileExtension: ".png",
    },
    {
      key: "49a79d66bdea2debf1832bf4d7aca127",
      url: "https://pub-23962046f76042c5b619ac24f84ed16d.r2.dev/12b16755-3c44-418c-a6af-373ed18301ae/49a79d66bdea2debf1832bf4d7aca127",
      hash: "TDIlFNJlBiqj9_vYH1t5ORzLdCaOaiBgAGHgzjMjT0E",
      contentType: "font/ttf",
      fileExtension: ".ttf",
    },
  ],
  metadata: {},
  createdAt: "2024-05-09T16:01:00.389Z",
  launchAsset: {
    key: "e5f392992ae6c6f8a7d6f0dfa7b9052a",
    url: "https://lemur-stirred-amazingly.ngrok-free.app/projects/0ffc554b/manifest/launchable?manifest_id=ae22c8bd-8044-4a65-9000-e4350d61553f&platform=android",
    hash: "9lwwx8JySOdX5iPTiE0C43eO6a0JUnMFnne9BO4cQN8",
    contentType: "application/javascript",
    fileExtension: ".bundle",
  },
  runtimeVersion: "sdk-50.v-3",
};

// expo_main();

sign_manifest(xxx, SIGN_KEY_PATH).then(console.log);
