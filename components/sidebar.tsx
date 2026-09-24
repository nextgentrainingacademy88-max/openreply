"use client";

/**
 * Sidebar Navigation
 *
 * Icon + label nav with an accent-soft active state and a left indicator
 * bar. Logo mark (accent rounded square + reply icon) up top, workspace
 * name + theme toggle in the footer.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Inbox as InboxIcon,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  MessageCircleReply,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui";

const navItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Overview", href: "/overview", icon: BarChart3 },
  { label: "Inbox", href: "/inbox", icon: InboxIcon },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "DM Logs", href: "/logs", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
  { label: "Diagnostics", href: "/diagnostics", icon: Activity },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export default function Sidebar({ isOpen, onClose, workspaceName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-dvh w-64 max-w-[85vw] shrink-0 bg-surface border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Same reason as the top bar: the drawer is full height, so the
            logo would otherwise land under the status bar. */}
        <div
          className="px-5 py-5 border-b border-border"
          style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
              <MessageCircleReply className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </span>
            <span className="text-base font-extrabold tracking-tight text-foreground">
              OpenReply
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`
                  relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }
                `}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-full bg-accent"
                  />
                )}
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-between gap-3 px-4 py-4 border-t border-border">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{workspaceName}</p>
            <p className="text-xs text-muted">Self-hosted</p>
          </div>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
