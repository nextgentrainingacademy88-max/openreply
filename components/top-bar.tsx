"use client";

/**
 * Top Bar
 *
 * Page title, mobile hamburger, and connection status. Account count now
 * renders as a Badge "chip" instead of plain text; the connect CTA reuses
 * Button's primary styling.
 */

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Badge, buttonClasses } from "@/components/ui";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/overview": "Overview",
  "/inbox": "Inbox",
  "/campaigns": "Campaigns",
  "/campaigns/new": "New Campaign",
  "/automations": "Campaigns",
  "/automations/new": "New Campaign",
  "/logs": "DM Logs",
  "/settings": "Settings",
  "/diagnostics": "Diagnostics",
};

interface TopBarProps {
  onMenuClick: () => void;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function TopBar({
  onMenuClick,
  instagramUsername,
  instagramAccountCount,
}: TopBarProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Dashboard";

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-8 border-b border-border bg-background"
      // Installed to the home screen the app starts at the very top of the
      // display, so without this the title sits under the clock and battery.
      // The inset is 0 in a browser tab and on desktop.
      style={{
        height: "calc(4rem + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-foreground hover:bg-surface-hover"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </button>
        <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{title}</h1>
      </div>

      {instagramAccountCount > 0 ? (
        <Badge tone="accent" className="shrink-0">
          {instagramAccountCount > 1
            ? `${instagramAccountCount} accounts`
            : `@${instagramUsername}`}
        </Badge>
      ) : (
        // A real <a>, not ButtonLink/next-link: this has to force a full
        // browser navigation into the Meta OAuth handshake, which a
        // client-side router navigation could intercept and mishandle.
        <a href="/api/instagram/connect" className={buttonClasses("primary", "sm", "shrink-0")}>
          {/* Full label needs more room than a 360px header has to spare. */}
          <span className="sm:hidden">Connect</span>
          <span className="hidden sm:inline">Connect Instagram</span>
        </a>
      )}
    </header>
  );
}
