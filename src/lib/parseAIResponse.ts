export type ParsedResponse =
  | { type: "text"; content: string }
  | { type: "stylePreviews"; previews: string[]; names: string[] }
  | { type: "finalPresentation"; html: string; textBefore: string };

function extractOptionNames(content: string, count: number): string[] {
  // Match "Option 1 — Name:" or "Option 1 - Name:" patterns (bold or plain)
  const matches = [
    ...content.matchAll(/Option\s+\d+\s*[—–-]+\s*([^:*\n\]]+)/gi),
  ];
  if (matches.length >= count) {
    return matches.slice(0, count).map((m) => m[1].trim());
  }
  return Array.from({ length: count }, (_, i) => `Option ${i + 1}`);
}

export function parseAIResponse(content: string): ParsedResponse {
  // Check for style previews: 3 HTML fenced code blocks FIRST
  const htmlBlockRegex = /```html\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  for (const m of content.matchAll(htmlBlockRegex)) {
    blocks.push(m[1]);
  }
  if (blocks.length >= 3) {
    const names = extractOptionNames(content, 3);
    return { type: "stylePreviews", previews: blocks.slice(0, 3), names };
  }

  // Check for final presentation: single large <!DOCTYPE html> block
  const doctypeIndex = content.search(/<!DOCTYPE html>/i);
  if (doctypeIndex !== -1) {
    const htmlContent = content.slice(doctypeIndex);
    if (htmlContent.length > 5000) {
      const textBefore = content.slice(0, doctypeIndex).trim();
      return { type: "finalPresentation", html: htmlContent, textBefore };
    }
  }

  // Regular text
  return { type: "text", content };
}

// Strip fenced code blocks for plain text display
export function stripCodeBlocks(content: string): string {
  return content
    .replace(/```html[\s\S]*?```/g, "[HTML Preview]")
    .replace(/```[\s\S]*?```/g, "[Code Block]")
    .trim();
}
