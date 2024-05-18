import { existsSync, readFileSync } from "fs";
import path from "path";

export const fs_exists = (...paths: Parameters<typeof path.resolve>) => existsSync(path.resolve(...paths));

export const read_file = (...paths: Parameters<typeof path.resolve>) =>
  fs_exists(...paths) && readFileSync(path.resolve(...paths)).toString();
