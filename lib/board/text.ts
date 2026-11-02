export function boardTextParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let offset = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const start = match.index!;
    if (start > offset) parts.push({ text: text.slice(offset, start) });
    const candidate = match[0].replace(/[.,!?;:)\]}]+$/, "");
    try {
      const url = new URL(candidate);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      parts.push({ text: candidate, href: url.href });
      if (candidate.length < match[0].length) parts.push({ text: match[0].slice(candidate.length) });
    } catch { parts.push({ text: match[0] }); }
    offset = start + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return parts;
}
