export function log(tag: string, message: string, extra?: unknown) {
  if (!__DEV__) return;
  if (extra !== undefined) console.log(`[${tag}] ${message}`, extra);
  else console.log(`[${tag}] ${message}`);
}
