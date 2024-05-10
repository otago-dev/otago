import execa from "execa";
import path from "path";

export const get_current_git_version = async (root_dir: string) => {
  try {
    const { stdout } = await execa("git", ["log", "--pretty=tformat:%h", "-n1", path.resolve(root_dir)]);
    return stdout;
  } catch (error) {
    return "";
  }
};
