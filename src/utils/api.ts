import { createReadStream } from "fs";
import fs from "fs/promises";
import mime from "mime";
import fetch, { Response as FetchResponse } from "node-fetch";
import { create_hash, create_signature } from "./signing";

import type { SigningConfig } from "./signing";
import type { Manifest } from "./types";

const OTAGO_BASE_URL = process.env.OTAGO_BASE_URL || "https://otago.dev";

// Bound the number of concurrent asset requests. Firing every asset of every
// platform at once (unbounded Promise.all) overwhelms the deploy path and makes
// some requests arrive body-less server-side -> 400 "Form errors". A shared,
// module-level limiter throttles all platforms together.
const UPLOAD_CONCURRENCY = Math.max(1, Number(process.env.OTAGO_UPLOAD_CONCURRENCY) || 15);
const ASSET_UPLOAD_RETRIES = Math.max(0, Number(process.env.OTAGO_UPLOAD_RETRIES) || 4);

const create_limiter = (max: number) => {
  let active = 0;
  const queue: (() => void)[] = [];
  const drain = () => {
    if (active >= max || queue.length === 0) return;
    active++;
    queue.shift()!();
  };
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    await new Promise<void>((resolve) => {
      queue.push(resolve);
      drain();
    });
    try {
      return await fn();
    } finally {
      active--;
      drain();
    }
  };
};

const upload_limit = create_limiter(UPLOAD_CONCURRENCY);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 400 is retryable on purpose: a request body dropped in transit surfaces as a
// server-side validation error ("Form errors") that succeeds on retry.
const is_retryable_status = (status: number) =>
  status >= 500 || status === 400 || status === 408 || status === 409 || status === 425 || status === 429;

const fetch_with_retry = async (
  description: string,
  do_fetch: () => Promise<FetchResponse>,
  { retries = ASSET_UPLOAD_RETRIES, base_delay_ms = 300 }: { retries?: number; base_delay_ms?: number } = {},
): Promise<FetchResponse> => {
  let last_detail = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(base_delay_ms * 2 ** (attempt - 1) + Math.floor(Math.random() * 100));
    }
    try {
      const response = await do_fetch();
      if (response.ok) return response;
      last_detail = `${response.status} ${(await response.text().catch(() => "")).slice(0, 200)}`;
      if (!is_retryable_status(response.status)) break;
    } catch (error) {
      last_detail = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`otago::${description} failed after ${retries + 1} attempt(s): ${last_detail}`);
};

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
  async (args: { otago_api_key: string; project_ref: string; file_absolutepath: string; file_ext: string }) =>
    // Throttle every asset through the shared limiter so both platforms fan out together.
    upload_limit(() => upload_deployment_asset_uncached(args)),
);

const upload_deployment_asset_uncached = async ({
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

  // Register the asset (get its url). Retries transparently on transient failures
  // (network reset, 5xx, or a body dropped in transit surfacing as a 400 "Form errors").
  // Never let a failed registration silently produce a manifest asset without a url:
  // a url-less asset makes expo-updates crash natively at launch (requiredValue("url")).
  const response = await fetch_with_retry(`assets:register ${file_data.key} (${file_ext})`, () =>
    fetch(`${OTAGO_BASE_URL}/api/projects/${project_ref}/assets`, {
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
    }),
  );

  const { upload_url, url } = await response.json();

  if (!url) {
    throw new Error(
      `otago::upload_deployment_asset missing url for ${file_data.key} (${file_ext}); refusing to build a corrupt manifest`,
    );
  }

  if (upload_url) {
    const file_stat = await fs.stat(file_absolutepath);
    // Recreate the read stream on every attempt: a consumed stream cannot be replayed.
    await fetch_with_retry(`assets:upload ${file_data.key} (${file_ext})`, () =>
      fetch(upload_url, {
        method: "PUT",
        body: createReadStream(file_absolutepath),
        headers: {
          "Content-Length": file_stat.size.toString(),
          "Content-Type": file_data.contentType, // not present in r2 presigned url
        },
      }),
    );

    await fetch_with_retry(`assets:confirm ${file_data.key} (${file_ext})`, () =>
      fetch(`${OTAGO_BASE_URL}/api/projects/${project_ref}/assets/${file_data.key}/uploaded`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": otago_api_key,
        },
      }),
    );

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
