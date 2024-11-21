import { createReadStream } from "fs";
import fs from "fs/promises";
import mime from "mime";
import fetch from "node-fetch";
import { create_hash, create_signature } from "./signing";

import type { SigningConfig } from "./signing";
import type { Manifest } from "./types";

const OTAGO_BASE_URL = process.env.OTAGO_BASE_URL || "https://otago.dev";

type CompanyProjectDto = {
  id: string;
  company_id: string;
  ref: string;
  name: string;
  env: string;
  slug: string;
  metadata: object;
  display_name: string;
  manifest_url: string;
  created_at: string;
};

export const get_project = async (project_ref: string, otago_api_key: string) => {
  const response = await fetch(`${OTAGO_BASE_URL}/api/projects/${project_ref}`, {
    headers: {
      "Content-Type": "application/json",
      "Api-Key": otago_api_key,
    },
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error("Forbidden, please check your API key");
    if (response.status === 404) throw new Error(`Project not found: ${project_ref}`);
    throw new Error(`Error getting project: ${response.statusText}`);
  }
  return (await response.json()) as CompanyProjectDto;
};

export const create_project_deployment = async (project_ref: string, otago_api_key: string, params: object) => {
  const response = await fetch(`${OTAGO_BASE_URL}/api/projects/${project_ref}/deployments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": otago_api_key,
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(`Error creating deployment: ${response.statusText}`);
  return (await response.json()) as { id: string };
};

export const upload_deployment_asset = memoize(
  async ({
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
  },
);

export const send_deployment_manifest = async ({
  manifest_android,
  manifest_ios,
  otago_deployment_id,
  otago_project_id,
  otago_api_key,
  otago_project_manifest_url,
  signing_config,
}: {
  manifest_android: Manifest | undefined; // used for TS checking
  manifest_ios: Manifest | undefined;
  otago_deployment_id: string;
  otago_project_id: string;
  otago_api_key: string;
  otago_project_manifest_url: string;
  signing_config?: SigningConfig;
}) => {
  const manifest_android_final = manifest_android
    ? {
        ...manifest_android,
        launchAsset: {
          ...manifest_android.launchAsset,
          url: `${otago_project_manifest_url}/launchable?manifest_id=${manifest_android.id}&platform=android`,
        },
      }
    : undefined;

  const manifest_ios_final = manifest_ios
    ? {
        ...manifest_ios,
        launchAsset: {
          ...manifest_ios.launchAsset,
          url: `${otago_project_manifest_url}/launchable?manifest_id=${manifest_ios.id}&platform=ios`,
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
            manifest_raw: JSON.stringify(manifest_android_final!),
            signature: signing_config
              ? await create_signature(JSON.stringify(manifest_android_final!), signing_config)
              : null,
          }
        : undefined,
      ios: manifest_ios
        ? {
            launchable_url: manifest_ios.launchAsset.url,
            manifest_raw: JSON.stringify(manifest_ios_final!),
            signature: signing_config
              ? await create_signature(JSON.stringify(manifest_ios_final!), signing_config)
              : null,
          }
        : undefined,
    }),
  });
};

function memoize<P, R>(fn: (...args: P[]) => R) {
  const cache = new Map();
  const cached = function (this: unknown, ...val: P[]): R {
    const key = JSON.stringify(val);
    return cache.has(key) ? cache.get(key) : cache.set(key, fn.call(this, ...val)) && cache.get(key);
  };
  cached.cache = cache;
  return cached;
}
