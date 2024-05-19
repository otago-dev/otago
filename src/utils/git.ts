import { exec_command } from "./cli";

export const get_current_git_version = async (root_dir: string) => {
  try {
    const stdout = await exec_command(root_dir, "git log --pretty=tformat:%h -n1");
    return stdout.trim();
  } catch (error) {
    return "";
  }
};
