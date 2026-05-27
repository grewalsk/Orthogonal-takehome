import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";

// Persistent layout for all /c/[id] routes. The sidebar stays mounted as
// the user navigates between conversations, so the recent-chats list and
// tools-in-use state do not flash on each route change.
export default function ConversationsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--paper)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
