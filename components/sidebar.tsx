"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PanelLeft, Pin, Plus } from "lucide-react";

interface ConvSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [recent, setRecent] = useState<ConvSummary[]>([]);

  const currentId = useMemo(() => {
    const m = pathname?.match(/^\/c\/([0-9a-f-]+)/i);
    return m?.[1] ?? null;
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : { recent: [] }))
      .then((data: { recent: ConvSummary[] }) => {
        if (cancelled) return;
        setRecent(data.recent ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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

      {/* Chats list — only visible when expanded */}
      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto">
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
