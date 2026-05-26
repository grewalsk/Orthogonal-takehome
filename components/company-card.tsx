"use client";

import { Building2, Users, Calendar, MapPin, ExternalLink, Globe } from "lucide-react";

interface Props {
  summary: Record<string, unknown>;
}

export function CompanyCard({ summary }: Props) {
  const name = (summary.name as string | null) ?? null;
  const domain = (summary.domain as string | null) ?? null;
  const industry = (summary.industry as string | null) ?? null;
  const employees = (summary.employee_count as number | null) ?? null;
  const founded = (summary.founded_year as number | null) ?? null;
  const hq = (summary.headquarters as string | null) ?? null;
  const linkedin = (summary.linkedin_url as string | null) ?? null;
  const description = (summary.description as string | null) ?? null;

  return (
    <div>
      <div className="flex items-start gap-2">
        <Building2 className="mt-0.5 h-4 w-4 text-zinc-500" />
        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {name ?? <span className="italic text-zinc-500">unknown company</span>}
          </div>
          {domain && (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {domain}
            </a>
          )}
        </div>
      </div>
      {description && (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{description}</p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
        {industry && (
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {industry}
          </div>
        )}
        {employees !== null && (
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {Number(employees).toLocaleString()} employees
          </div>
        )}
        {founded !== null && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Founded {founded}
          </div>
        )}
        {hq && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {hq}
          </div>
        )}
        {linkedin && (
          <a
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <ExternalLink className="h-3 w-3" />
            LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}
