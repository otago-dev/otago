import crypto from "crypto";

import type { BinaryToTextEncoding } from "crypto";

export type SigningConfig = { private_key: string; keyid: string; alg: string };

export const create_hash = (file: Buffer, hashingAlgorithm: string, encoding: BinaryToTextEncoding) => {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding);
};

export const create_signature = async (content: string, { private_key, keyid, alg }: SigningConfig) => {
  const sign = crypto.createSign(/sha256/i.test(alg) ? "RSA-SHA256" : "RSA-SHA256");
  sign.update(content, "utf8");
  sign.end();
  const hash_sig = sign.sign(private_key, "base64");

  return `sig="${hash_sig}", keyid="${keyid}"`;
};
