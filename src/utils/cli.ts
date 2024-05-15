import cliCursor from "cli-cursor";

const stream = process.stdout;

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

export const step_spinner = (text: string) => {
  cliCursor.hide(stream);

  let i = 0;
  replace(`${spinner_frames[i]} ${text}`);
  const interval = setInterval(
    () => replace(`${spinner_frames[++i % spinner_frames.length]} ${text}`),
    spinner_frame_interval,
  );

  const end = (is_success: boolean) => {
    clearInterval(interval);
    replace(`${is_success ? "✓" : "✗"} ${text}`);
    stream.write("\n");
    cliCursor.show(stream);
  };

  return {
    succeed: () => end(true),
    fail: () => end(false),
  };
};
