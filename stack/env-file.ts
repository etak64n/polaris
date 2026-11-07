// Reads and writes .env, the file of the account and the secrets. Each line is
// KEY=VALUE; blank lines and lines that start with # are skipped, and quotes around a
// value are removed.

export function parseEnvFile(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) value = value.slice(1, -1);
    values.set(key, value);
  }
  return values;
}

/** The text of .env with KEY=value: the line of the key replaced, or a line added at the end. */
export function withEnvValue(text: string, key: string, value: string): string {
  const lines = text.split("\n");
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (index !== -1) {
    lines[index] = `${key}=${value}${lines[index]?.endsWith("\r") ? "\r" : ""}`;
    return lines.join("\n");
  }
  return `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}${key}=${value}\n`;
}
