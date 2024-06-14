import { exec_command } from "./cli";

export const get_current_git_version = async (root_dir: string) => {
  let commit_tag_gitcli = undefined;
  try {
    const stdout = await exec_command(root_dir, "git rev-parse --short HEAD");
    commit_tag_gitcli = stdout.trim();
  } catch (error) {}

  const commit_tag_github = (process.env.GITHUB_SHA || "").substring(0, 7);
  const commit_tag_gitlab = process.env.CI_COMMIT_SHORT_SHA;

  return commit_tag_gitcli || commit_tag_github || commit_tag_gitlab || "";
};
