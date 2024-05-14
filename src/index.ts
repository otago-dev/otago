#!/usr/bin/env node

import { program } from "commander";
import fs from "fs";
import path from "path";
import deploy from "./deploy";

const { version } = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../package.json`)).toString());

program
  .name("otago")
  .description("CLI to deploy your code pushes with Otago services.")
  .version(version, "-v, --version");

program
  .command("deploy")
  .description("Deploy your code pushes with Otago services.")
  .argument("<project_ref>", "Project reference you want to deploy to.")
  .requiredOption("-k, --key <api_key>", "API key to authenticate with Otago services.")
  .action(deploy);

program.parse();
