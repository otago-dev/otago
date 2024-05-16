#!/usr/bin/env node

import { program } from "commander";
import fs from "fs";
import path from "path";
import config from "./config";
import deploy from "./deploy";

const { OTAGO_API_KEY, OTAGO_PROJECT } = process.env;
const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../package.json`)).toString());

program
  .name("otago")
  .description("CLI to deploy your code pushes with Otago services.")
  .version(version, "-v, --version");

program
  .command("config")
  .requiredOption("-k, --key <api_key>", "API key to authenticate with Otago services.", OTAGO_API_KEY)
  .requiredOption("-p, --project <project>", "Project reference you want to deploy to.", OTAGO_PROJECT)
  .action(config);

program
  .command("deploy")
  .description("Deploy your code pushes with Otago services.")
  .requiredOption("-k, --key <api_key>", "API key to authenticate with Otago services.", OTAGO_API_KEY)
  .requiredOption("-p, --project <project>", "Project reference you want to deploy to.", OTAGO_PROJECT)
  .action(deploy);

program.parse();
