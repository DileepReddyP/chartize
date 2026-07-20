function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The rendered chart image could not be read."));
    image.src = url;
  });
}

function canvasLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0]!;
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) line = candidate;
    else { lines.push(line); line = word; }
  }
  lines.push(line);
  return lines;
}

export async function pngWithHeader(chartUrl: string, title: string, subtitle: string) {
  if (!title.trim() && !subtitle.trim()) return chartUrl;
  const image = await loadImage(chartUrl);
  const scale = image.naturalWidth >= 1_000 ? 2 : 1;
  const padding = 28 * scale;
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) throw new Error("Canvas export is unavailable.");
  measure.font = `300 ${34 * scale}px system-ui, sans-serif`;
  const titleLines = canvasLines(measure, title, image.naturalWidth - padding * 2);
  measure.font = `400 ${14 * scale}px system-ui, sans-serif`;
  const subtitleLines = canvasLines(measure, subtitle, image.naturalWidth - padding * 2);
  const headerHeight = padding + titleLines.length * 39 * scale + (subtitleLines.length ? 8 * scale + subtitleLines.length * 20 * scale : 0) + 18 * scale;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight + headerHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas export is unavailable.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0a0f0d";
  context.font = `300 ${34 * scale}px system-ui, sans-serif`;
  titleLines.forEach((line, index) => context.fillText(line, padding, padding + 32 * scale + index * 39 * scale));
  context.fillStyle = "#596662";
  context.font = `400 ${14 * scale}px system-ui, sans-serif`;
  const subtitleTop = padding + titleLines.length * 39 * scale + 8 * scale;
  subtitleLines.forEach((line, index) => context.fillText(line, padding, subtitleTop + 14 * scale + index * 20 * scale));
  context.drawImage(image, 0, headerHeight);
  return canvas.toDataURL("image/png");
}

function xmlText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function approximateLines(text: string, maxCharacters: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharacters) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

export async function svgWithHeader(chartUrl: string, title: string, subtitle: string) {
  if (!title.trim() && !subtitle.trim()) return chartUrl;
  const source = await (await fetch(chartUrl)).text();
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.nodeName.toLocaleLowerCase() !== "svg") throw new Error("The rendered SVG could not be read.");
  const viewBox = root.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const width = Number.parseFloat(root.getAttribute("width") ?? "") || viewBox?.[2] || 800;
  const height = Number.parseFloat(root.getAttribute("height") ?? "") || viewBox?.[3] || 500;
  const scale = width >= 1_000 ? 2 : 1;
  const padding = 28 * scale;
  const titleSize = 34 * scale;
  const subtitleSize = 14 * scale;
  const titleLines = approximateLines(title, Math.max(12, Math.floor((width - padding * 2) / (titleSize * .54))));
  const subtitleLines = approximateLines(subtitle, Math.max(18, Math.floor((width - padding * 2) / (subtitleSize * .52))));
  const headerHeight = padding + titleLines.length * 39 * scale + (subtitleLines.length ? 8 * scale + subtitleLines.length * 20 * scale : 0) + 18 * scale;
  const titleText = titleLines.map((line, index) => `<text x="${padding}" y="${padding + 32 * scale + index * 39 * scale}" fill="#0a0f0d" font-family="system-ui, sans-serif" font-size="${titleSize}" font-weight="300">${xmlText(line)}</text>`).join("");
  const subtitleTop = padding + titleLines.length * 39 * scale + 8 * scale;
  const subtitleText = subtitleLines.map((line, index) => `<text x="${padding}" y="${subtitleTop + 14 * scale + index * 20 * scale}" fill="#596662" font-family="system-ui, sans-serif" font-size="${subtitleSize}" font-weight="400">${xmlText(line)}</text>`).join("");
  const exported = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + headerHeight}" viewBox="0 0 ${width} ${height + headerHeight}"><rect width="100%" height="100%" fill="#ffffff"/>${titleText}${subtitleText}<g transform="translate(0 ${headerHeight})">${root.innerHTML}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(exported)}`;
}
