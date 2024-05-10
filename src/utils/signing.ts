import crypto from "crypto";
import fs from "fs/promises";

import type { BinaryToTextEncoding } from "crypto";

const read_private_key = (key_path: string) => {
  return fs.readFile(key_path, "utf-8");
};

export const create_hash = (file: Buffer, hashingAlgorithm: string, encoding: BinaryToTextEncoding) => {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding);
};

export const create_signature = async (content: string, key_path: string) => {
  const privateKey = await read_private_key(key_path);
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(content, "utf8");
  sign.end();
  const hash_sig = sign.sign(privateKey, "base64");

  return `sig="${hash_sig}", keyid="main"`;
};
