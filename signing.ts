import fs from "fs/promises";
import crypto from "crypto";
import type { Manifest } from "./misc";

const read_private_key = (key_path: string) => {
  return fs.readFile(key_path, "utf-8");
};

export const sign_manifest = async (manifest: Manifest, key_path: string) => {
  const privateKey = await read_private_key(key_path);
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(JSON.stringify(manifest), "utf8");
  sign.end();
  const hash_sig = sign.sign(privateKey, "base64");

  return `sig="${hash_sig}", keyid="main"`;
};
