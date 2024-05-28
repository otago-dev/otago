#!/usr/bin/env node

import { program } from "commander";
import deploy from "./deploy";
import doctor from "./doctor";
import { load_env } from "./utils/app";
import { read_file } from "./utils/file";

const { version } = JSON.parse(read_file(__dirname, `../package.json`) || "{}");

program
  .name("otago")
  .description("CLI to deploy your code pushes with Otago services.")
  .version(version, "-v, --version");

if (["doctor", "deploy"].includes(process.argv[2])) {
  load_env(".");
}
const { OTAGO_API_KEY, OTAGO_PRIVATE_KEY, OTAGO_PROJECT } = process.env;

program
  .command("doctor")
  .alias("check-config")
  .requiredOption("-k, --key <api_key>", "API key to authenticate with Otago services.", OTAGO_API_KEY)
  .requiredOption("-p, --project <project>", "Project reference you want to deploy to.", OTAGO_PROJECT)
  .action(doctor);

program
  .command("deploy")
  .description("Deploy your code pushes with Otago services.")
  .requiredOption("-k, --key <api_key>", "API key to authenticate with Otago services.", OTAGO_API_KEY)
  .requiredOption("-p, --project <project>", "Project reference you want to deploy to.", OTAGO_PROJECT)
  .option("-pk, --private-key <private_key>", "Private key (or its path) to sign your update.", OTAGO_PRIVATE_KEY)
  .option<string[]>(
    "-pf, --platforms <platforms>",
    "Platforms to deploy, comma separated.",
    (v) => v.split(",").map((v) => v.trim()),
    [],
  )
  .action(deploy);

program.parse();
