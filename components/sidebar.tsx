"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Cpu,
  FileText,
  Globe,
  Mic,
  PanelLeft,
  Pin,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

interface ConvSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface ToolCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  slugPrefixes: string[];
}

// Sidebar tool taxonomy. Each category lights up when any tool with a
// matching slug prefix has been called in the current conversation. The
// design's intent is "what capabilities is this assistant using right
// now," not the full 36-endpoint list.
const TOOL_CATEGORIES: ToolCategory[] = [
  { id: "web", label: "Web search", icon: Globe, slugPrefixes: ["linkup_", "exa_", "serper_"] },
  { id: "scrape", label: "Page scrape", icon: FileText, slugPrefixes: ["olostep_"] },
  { id: "people", label: "People intel", icon: Users, slugPrefixes: ["apollo_people", "apollo_mixed_people", "hunter_domain", "hunter_email", "tomba_email", "tomba_combined", "tomba_linkedin"] },
  { id: "company", label: "Company & brand", icon: Building2, slugPrefixes: ["apollo_organizations", "hunter_companies", "branddev_", "logo_", "fundable_", "predictleads_discover_companies"] },
  { id: "intent", label: "Intent signals", icon: Sparkles, slugPrefixes: ["predictleads_discover_news", "predictleads_discover_financing", "predictleads_discover_job"] },
  { id: "tech", label: "Tech detection", icon: Cpu, slugPrefixes: ["tomba_technology", "predictleads_technologies"] },
  { id: "voice", label: "Voice & media", icon: Mic, slugPrefixes: ["elevenlabs_"] },
  { id: "identity", label: "Identity", icon: ShieldCheck, slugPrefixes: ["didit_"] },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [recent, setRecent] = useState<ConvSummary[]>([]);
  const [toolNames, setToolNames] = useState<string[]>([]);

  const currentId = useMemo(() => {
    const m = pathname?.match(/^\/c\/([0-9a-f-]+)/i);
    return m?.[1] ?? null;
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const url = currentId ? `/api/conversations?currentId=${currentId}` : "/api/conversations";
    fetch(url)
      .then((r) => (r.ok ? r.json() : { recent: [], currentToolNames: [] }))
      .then((data: { recent: ConvSummary[]; currentToolNames: string[] }) => {
        if (cancelled) return;
        setRecent(data.recent ?? []);
        setToolNames(data.currentToolNames ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentId, pathname]);

  const usedCategories = useMemo(() => {
    const used = new Set<string>();
    for (const slug of toolNames) {
      for (const cat of TOOL_CATEGORIES) {
        if (cat.slugPrefixes.some((p) => slug.startsWith(p))) used.add(cat.id);
      }
    }
    return used;
  }, [toolNames]);

  const activeCount = TOOL_CATEGORIES.filter((c) => usedCategories.has(c.id)).length;

  return (
    <aside
      className="flex flex-col overflow-hidden border-r border-[var(--rule)] bg-[var(--paper-deep)] transition-[width] duration-300 ease-out"
      style={{ width: open ? 248 : 56, flexShrink: 0 }}
    >
      {/* Brand + toggle */}
      <div className="flex items-center justify-between px-4 pt-[18px] pb-[14px] text-[var(--ink)]">
        {open ? <Wordmark /> : <WordmarkGlyph />}
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? "Collapse" : "Expand"}
          className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md text-[var(--ink-muted)] transition hover:bg-black/5"
        >
          <PanelLeft className="h-[14px] w-[14px]" strokeWidth={1.4} />
        </button>
      </div>

      {/* New chat */}
      <div className="px-[10px] pt-[6px] pb-1">
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            router.push(`/c/${id}`);
          }}
          className="flex w-full items-center gap-[10px] rounded-lg border border-[var(--rule)] bg-[var(--paper)] px-3 py-[10px] text-[13.5px] font-medium text-[var(--ink)] shadow-[var(--shadow-card)]"
          style={{ justifyContent: open ? "flex-start" : "center" }}
        >
          <Plus className="h-[14px] w-[14px]" strokeWidth={1.4} />
          {open && <span>New chat</span>}
          {open && (
            <span className="ml-auto rounded border border-[var(--rule)] px-[5px] py-px font-mono text-[10px] text-[var(--ink-faint)]">
              ⌘K
            </span>
          )}
        </button>
      </div>

      {/* Sections */}
      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Pinned is empty for v1 (no schema yet). Render only when we
              add real pinned data — keeping the section as a deliberate
              spec note rather than a stub. */}

          <SideSection label="Chats">
            {recent.length === 0 && (
              <div className="px-4 py-2 text-xs italic text-[var(--ink-faint)]">No chats yet.</div>
            )}
            {recent.map((c) => (
              <ChatRow key={c.id} id={c.id} title={c.title} active={c.id === currentId} pinned={false} />
            ))}
          </SideSection>
        </div>
      )}

      {/* Tools in use */}
      {open && (
        <div className="border-t border-[var(--rule)] bg-[var(--paper-deep)] px-[6px] pt-3 pb-[14px]">
          <div className="flex items-center gap-[6px] px-3 pb-2 text-[10.5px] font-medium uppercase tracking-[.08em] text-[var(--ink-faint)]">
            <span>Tools in use</span>
            <span className="rounded border border-[var(--rule)] px-1 font-mono text-[9.5px] tracking-normal">
              {activeCount}/{TOOL_CATEGORIES.length}
            </span>
          </div>
          <div className="flex flex-col gap-px">
            {TOOL_CATEGORIES.map((c) => (
              <ToolRow key={c.id} category={c} on={usedCategories.has(c.id)} />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-[10px]">
      <WordmarkGlyph />
      <span className="font-serif text-[17px] font-medium tracking-[-0.01em]">Orthogonal</span>
    </span>
  );
}

function WordmarkGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden className="text-[var(--ink)]">
      <rect x="2.5" y="2.5" width="19" height="19" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="7" y="7" width="10" height="10" fill="currentColor" opacity=".85" />
      <line x1="2.5" y1="12" x2="7" y2="12" stroke="currentColor" strokeWidth="1.2" />
      <line x1="17" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function SideSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1">
      <div className="px-4 pb-[6px] text-[10.5px] font-medium uppercase tracking-[.08em] text-[var(--ink-faint)]">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ChatRow({ id, title, active, pinned }: { id: string; title: string; active: boolean; pinned: boolean }) {
  return (
    <Link
      href={`/c/${id}`}
      className={`mx-[6px] flex items-center gap-2 rounded-md px-[10px] py-[7px] text-[13px] transition ${
        active
          ? "bg-black/[0.055] text-[var(--ink)] dark:bg-white/[0.06]"
          : "text-[var(--ink-soft)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      }`}
    >
      {pinned && (
        <span className="inline-flex flex-shrink-0 text-[var(--accent-ink)]">
          <Pin className="h-3 w-3" strokeWidth={1.4} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </Link>
  );
}

function ToolRow({ category, on }: { category: ToolCategory; on: boolean }) {
  const Icon = category.icon;
  return (
    <div
      className="mx-1 flex items-center gap-[9px] rounded-md px-3 py-[6px] text-[12.5px]"
      style={{ color: on ? "var(--ink-soft)" : "var(--ink-faint)" }}
    >
      <span
        className="inline-flex"
        style={{ color: on ? "var(--accent-ink)" : "var(--ink-faint)", opacity: on ? 1 : 0.55 }}
      >
        <Icon className="h-[14px] w-[14px]" strokeWidth={1.4} />
      </span>
      <span className="min-w-0 flex-1 truncate">{category.label}</span>
      <span
        className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
        style={{
          background: on ? "var(--accent)" : "transparent",
          border: on ? "none" : "1px solid var(--ink-faint)",
        }}
      />
    </div>
  );
}
