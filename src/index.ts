#!/usr/bin/env node

import { Command, Option, program } from "commander";
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
const { OTAGO_API_KEY, OTAGO_PLATFORMS, OTAGO_PRIVATE_KEY, OTAGO_PROJECT } = process.env;

program
  .command("doctor")
  .alias("check-config")
  .addOption(
    new Option("-k, --key <api_key>", "API key to authenticate with Otago services.")
      .makeOptionMandatory()
      .env("OTAGO_API_KEY")
      .default(OTAGO_API_KEY, "*****"),
  )
  .addOption(
    new Option("-p, --project <project>", "Project reference you want to deploy to.")
      .makeOptionMandatory()
      .env("OTAGO_PROJECT")
      .default(OTAGO_PROJECT),
  )
  .action(actionWrapper(doctor));

program
  .command("deploy")
  .description("Deploy your code pushes with Otago services.")
  .addOption(
    new Option("-k, --key <api_key>", "API key to authenticate with Otago services.")
      .makeOptionMandatory()
      .env("OTAGO_API_KEY")
      .default(OTAGO_API_KEY, "*****"),
  )
  .addOption(
    new Option("-p, --project <project>", "Project reference you want to deploy to.")
      .makeOptionMandatory()
      .env("OTAGO_PROJECT")
      .default(OTAGO_PROJECT),
  )
  .addOption(
    new Option("-pf, --platforms <platforms>", "Platforms to deploy, comma separated.")
      .env("OTAGO_PLATFORMS")
      .default(OTAGO_PLATFORMS || "all"),
  )
  .addOption(
    new Option("-pk, --private-key <private_key>", "Private key (or its path) to sign your update.")
      .env("OTAGO_PRIVATE_KEY")
      .default(OTAGO_PRIVATE_KEY, "*****"),
  )
  .action(actionWrapper(deploy));

program.parse();

function actionErrorHanlder(error: Error) {
  console.error("[ERROR] " + error.message);
  process.exit(1);
}

export function actionWrapper(fn: Parameters<Command["action"]>[0]) {
  return async (...args: Parameters<Parameters<Command["action"]>[0]>) => {
    try {
      await fn(...args);
    } catch (error) {
      actionErrorHanlder(error as Error);
    }
  };
}
