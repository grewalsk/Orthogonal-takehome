export function wrapUntrusted(content: string | null | undefined, source: string, url?: string): string {
  const inner = String(content ?? "").replace(/<\/?untrusted_content[^>]*>/gi, "");
  const sourceAttr = escapeAttr(source);
  const urlAttr = url ? ` url="${escapeAttr(url)}"` : "";
  return `<untrusted_content source="${sourceAttr}"${urlAttr}>\n${inner}\n</untrusted_content>`;
}

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
