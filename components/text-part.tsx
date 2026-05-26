"use client";

import ReactMarkdown from "react-markdown";
import rehypeShiki from "@shikijs/rehype";

interface Props {
  text: string;
}

export function TextPart({ text }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
      <ReactMarkdown
        rehypePlugins={[
          [
            rehypeShiki,
            {
              themes: { light: "github-light", dark: "github-dark" },
              defaultColor: false,
            },
          ],
        ]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
