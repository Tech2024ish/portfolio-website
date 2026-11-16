import type { ArticleBlock } from "@/content/profile";

/**
 * A note's body is stored as plain text with a small markup, edited in the Studio:
 *
 *   ## Heading
 *   - list item
 *   ```language
 *   code
 *   ```
 *   Anything else is a paragraph; blank lines separate blocks.
 *
 * The result is rendered as text, never as HTML, so the markup cannot inject anything.
 */
export function parseArticleBody(source: string): ArticleBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ArticleBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    if (list.length) blocks.push({ type: "list", items: list });
    paragraph = [];
    list = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const trimmed = line.trim();
    const fence = trimmed.match(/^```([\w+#.-]*)$/);
    if (fence) {
      flush();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && lines[index]!.trim() !== "```") {
        code.push(lines[index]!);
        index += 1;
      }
      blocks.push({ type: "code", language: fence[1] || "text", code: code.join("\n") });
    } else if (trimmed === "") {
      flush();
    } else if (trimmed.startsWith("## ")) {
      flush();
      blocks.push({ type: "heading", text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith("- ")) {
      if (paragraph.length) flush();
      list.push(trimmed.slice(2).trim());
    } else {
      if (list.length) flush();
      paragraph.push(trimmed);
    }
  }
  flush();
  return blocks;
}

/** The inverse of `parseArticleBody`, used to export bundled notes. */
export function serializeArticleBody(blocks: readonly ArticleBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `## ${block.text}`;
        case "list":
          return block.items.map((item) => `- ${item}`).join("\n");
        case "code":
          return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
        default:
          return block.text;
      }
    })
    .join("\n\n");
}
