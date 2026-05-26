"use client";

import ReactMarkdown from "react-markdown";

interface Props {
  text: string;
}

// react-markdown@10 uses processor.runSync internally, which is incompatible
// with @shikijs/rehype's async highlighter (would throw "runSync finished
// async. Use run instead" the moment a markdown message rendered). Dropped
// the shiki plugin; code blocks fall back to plain <code>/<pre> styled by
// the Tailwind typography plugin. Documented in README under "trade-offs".
export function TextPart({ text }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
