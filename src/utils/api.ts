import { createReadStream } from "fs";
import fs from "fs/promises";
import mime from "mime";
import fetch from "node-fetch";
import { create_hash, create_signature } from "./signing";

import type { Manifest } from "./types";

const OTAGO_BASE_URL = process.env.OTAGO_BASE_URL || "https://otago.dev";
const SIGN_KEY_PATH = process.env.SIGN_KEY_PATH; // TODO: handle sign key path

export const create_project_deployment = async (project_ref: string, otago_api_key: string, params: object) => {
  const response = await fetch(`${OTAGO_BASE_URL}/api/projects/${project_ref}/deployments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": otago_api_key,
    },
    body: JSON.stringify(params),
  });
  return (await response.json()) as { deployment_id: string; deploy_base_url: string };
};

export const upload_deployment_asset = async ({
  otago_api_key,
  project_ref,
  file_absolutepath,
  file_ext,
}: {
  otago_api_key: string;
  project_ref: string;
  file_absolutepath: string;
  file_ext: string;
}) => {
  const asset_get_metadata = async (file_path: string, file_ext: string) => {
    const asset_buffer = await fs.readFile(file_path);
    const assetHash = create_hash(asset_buffer, "sha256", "base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const key = create_hash(asset_buffer, "md5", "hex");
    const contentType = file_ext === "bundle" ? "application/javascript" : mime.getType(file_ext)!;

    return {
      hash: assetHash,
      key,
      fileExtension: `.${file_ext}`,
      contentType,
    };
  };

  const file_data = await asset_get_metadata(file_absolutepath, file_ext);

  const response = await fetch(`${OTAGO_BASE_URL}/api/projects/${project_ref}/assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": otago_api_key,
    },
    body: JSON.stringify({
      filename: file_data.key,
      hash: file_data.hash,
      contentType: file_data.contentType,
    }),
  });
  const { upload_url, url } = await response.json();

  if (upload_url) {
    const payload = createReadStream(file_absolutepath);
    const file_stat = await fs.stat(file_absolutepath);
    const uploaded = await fetch(upload_url, {
      method: "PUT",
      body: payload,
      headers: {
        "Content-Length": file_stat.size.toString(),
        "Content-Type": file_data.contentType, // not present in r2 presigned url
      },
    });

    if (uploaded.status !== 200) {
      throw new Error(`otago::upload_deployment_asset failed to upload file ${file_absolutepath}`);
    }

    await fetch(`${OTAGO_BASE_URL}/api/projects/${project_ref}/assets/${file_data.key}/uploaded`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": otago_api_key,
      },
    });

    return { ...file_data, url, is_newly_uploaded: true };
  } else {
    return { ...file_data, url, is_newly_uploaded: false };
  }
};

export const send_deployment_manifest = async ({
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

  return fetch(`${OTAGO_BASE_URL}/api/projects/${otago_project_id}/deployments/${otago_deployment_id}/activate`, {
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
            signature: SIGN_KEY_PATH
              ? await create_signature(JSON.stringify(manifest_android_final!), SIGN_KEY_PATH)
              : null,
          }
        : undefined,
      ios: manifest_ios
        ? {
            launchable_url: manifest_ios.launchAsset.url,
            manifest: manifest_ios_final!,
            signature: SIGN_KEY_PATH
              ? await create_signature(JSON.stringify(manifest_ios_final!), SIGN_KEY_PATH)
              : null,
          }
        : undefined,
    }),
  });
};