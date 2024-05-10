import { program } from "commander";
import deploy from "./deploy";

program
  .name("otago-cli")
  .description("CLI to deploy your code pushes with Otago services.")
  .version(require("../package.json").version, "-v, --version");

program
  .command("deploy")
  .description("Deploy your code pushes with Otago services.")
  .argument("<project_ref>", "Project reference you want to deploy to.")
  .requiredOption("-k, --key <api_key>", "API key to authenticate with Otago services.")
  .action(deploy);

program.parse();
