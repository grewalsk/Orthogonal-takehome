"use client";

import { Mail, ExternalLink, Briefcase } from "lucide-react";

interface Props {
  summary: Record<string, unknown>;
}

export function ContactCard({ summary }: Props) {
  const name = (summary.name as string | null) ?? null;
  const title = (summary.title as string | null) ?? null;
  const email = (summary.email as string | null) ?? null;
  const employer = (summary.current_employer as string | null) ?? null;
  const linkedin = (summary.linkedin_url as string | null) ?? null;

  return (
    <div>
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {name ?? <span className="italic text-zinc-500">unknown name</span>}
      </div>
      {title && (
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          {title}
          {employer ? ` at ${employer}` : ""}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-1 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            <Mail className="h-3 w-3" />
            {email}
          </a>
        )}
        {linkedin && (
          <a
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            <ExternalLink className="h-3 w-3" />
            LinkedIn
          </a>
        )}
        {!email && employer && (
          <span className="flex items-center gap-1 text-zinc-500">
            <Briefcase className="h-3 w-3" />
            {employer}
          </span>
        )}
      </div>
    </div>
  );
}
