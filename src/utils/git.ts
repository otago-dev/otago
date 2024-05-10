import { exec } from "child_process";

export const get_current_git_version = async (root_dir: string) => {
  return new Promise<string>((resolve) => {
    exec("git log --pretty=tformat:%h -n1", { cwd: root_dir }, (error, stdout) => {
      resolve(error ? "" : stdout.trim());
    });
  });
};
