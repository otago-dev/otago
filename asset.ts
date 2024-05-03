import fs from "fs/promises";
import mime from "mime";
import path from "path";
import fetch from "node-fetch";

import crypto, { type BinaryToTextEncoding } from "crypto";
import { createReadStream } from "fs";

const asset_create_hash = (file: Buffer, hashingAlgorithm: string, encoding: BinaryToTextEncoding) => {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding);
};

const asset_get_metadata = async (file_path: string, file_ext: string) => {
  const asset_buffer = await fs.readFile(file_path);
  const assetHash = asset_create_hash(asset_buffer, "sha256", "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const key = asset_create_hash(asset_buffer, "md5", "hex");
  const contentType = file_ext === "bundle" ? "application/javascript" : mime.getType(file_ext)!;

  return {
    hash: assetHash,
    key,
    fileExtension: `.${file_ext}`,
    contentType,
  };
};

export const asset_upload = async ({
  otago_api_key,
  file_absolutepath,
  file_ext,
}: {
  otago_api_key: string;
  file_absolutepath: string;
  file_ext: string;
}) => {
  const file_data = await asset_get_metadata(file_absolutepath, file_ext);

  const res = await fetch("http://localhost:3000/api/projects/msjs-test/assets", {
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
  const res_json = await res.json();

  if (res_json.upload_url) {
    const payload = createReadStream(file_absolutepath);
    const file_stat = await fs.stat(file_absolutepath);
    const uploaded = await fetch(res_json.upload_url, {
      method: "PUT",
      body: payload,
      headers: {
        "Content-Length": file_stat.size.toString(),
        "Content-Type": file_data.contentType, // not present in r2 presigned url
      },
    });

    if (uploaded.status !== 200) {
      throw new Error("otago::asset_upload failed to upload file " + file_absolutepath);
    }

    await fetch(`http://localhost:3000/api/projects/msjs-test/assets/${file_data.key}/uploaded`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": otago_api_key,
      },
    });

    return {
      ...file_data,
      url: res_json.url,
      is_newly_uploaded: true,
    };
  } else {
    return {
      ...file_data,
      url: res_json.url,
      is_newly_uploaded: false,
    };
  }
};
