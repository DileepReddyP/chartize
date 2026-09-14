/** Formats tool activity within the progress stream's 300-character limit. */
export function toolProgress(label: string, detail: string) {
  const message = `${label}: ${detail.replace(/\s+/g, " ").trim()}`;
  return message.length > 300 ? `${message.slice(0, 299)}…` : message;
}
