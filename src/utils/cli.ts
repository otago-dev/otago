import cliCursor from "cli-cursor";
import { exec } from "child_process";

const stream = process.stdout;

// https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color#answer-41407246
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

export const colored_log = (color: keyof typeof colors, text: string) => {
  console.log(`${colors[color]}${text}${colors.reset}`);
};

const spinner_frames = [
  "▰▱▱▱▱▱",
  "▰▱▱▱▱▱",
  "▰▱▱▱▱▱",
  "▰▰▱▱▱▱",
  "▰▰▱▱▱▱",
  "▰▰▱▱▱▱",
  "▰▰▰▱▱▱",
  "▰▰▰▱▱▱",
  "▰▰▰▱▱▱",
  "▰▰▰▰▱▱",
  "▰▰▰▰▱▱",
  "▰▰▰▰▱▱",
  "▰▰▰▰▰▱",
  "▰▰▰▰▰▱",
  "▰▰▰▰▰▱",
  "▰▰▰▰▰▰",
  "▰▰▰▰▰▰",
  "▰▰▰▰▰▰",
  "▰▰▰▰▰▰",
  "▰▰▰▰▰▰",
  "▰▰▰▰▰▰",
  "▰▰▰▰▰▰",
  "▰▰▰▰▰▱",
  "▰▰▰▰▱▱",
  "▰▰▰▱▱▱",
  "▰▰▱▱▱▱",
  "▰▱▱▱▱▱",
  "▱▱▱▱▱▱",
  "▱▱▱▱▱▱",
  "▱▱▱▱▱▱",
  "▱▱▱▱▱▱",
  "▱▱▱▱▱▱",
  "▱▱▱▱▱▱",
];
const spinner_frame_interval = 80;

const replace = (text: string) => {
  stream.clearLine(0);
  stream.cursorTo(0);
  stream.write(text);
};

const dynamic_spinner = (text: string) => {
  cliCursor.hide(stream);

  let i = 0;
  replace(`${spinner_frames[i]} ${text}`);
  const interval = setInterval(
    () => replace(`${spinner_frames[++i % spinner_frames.length]} ${text}`),
    spinner_frame_interval,
  );

  const end = (is_success: boolean) => {
    clearInterval(interval);
    replace("");
    colored_log(is_success ? "green" : "red", `${is_success ? "✓" : "✗"} ${text}`);
    cliCursor.show(stream);
  };

  return end;
};

const no_spinner = (text: string) => {
  const delay_step = setTimeout(() => colored_log("gray", `${text}...`), 50);

  const end = (is_success: boolean) => {
    clearTimeout(delay_step);
    colored_log(is_success ? "green" : "red", `${is_success ? "✓" : "✗"} ${text}`);
  };

  return end;
};

export const step_spinner = (text: string) => {
  const end = stream.clearLine === undefined ? no_spinner(text) : dynamic_spinner(text);
  return {
    succeed: () => end(true),
    fail: () => end(false),
  };
};

export const exec_command = async (root_dir: string, command: string) => {
  return new Promise<string>((resolve, reject) => {
    exec(command, { cwd: root_dir }, (error, stdout) => {
      error ? reject(error) : resolve(stdout);
    });
  });
};
