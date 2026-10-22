"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Megaphone } from "lucide-react";
import { Badge, Button, Card, CardHeader, CardTitle } from "@/components/ui";

interface AvailablePage {
  id: string;
  name: string;
  connected: boolean;
}

/**
 * Lists the Facebook Pages the server's system-user token manages and connects
 * one with a click. Connected Pages then appear with the other accounts and
 * can run comment-to-Messenger campaigns, ads included.
 */
export function FacebookPagesCard() {
  const [pages, setPages] = useState<AvailablePage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/facebook/pages")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setPages(payload.data.pages);
        else {
          setTokenMissing(payload.code === "token_missing");
          setError(payload.error ?? "Could not load Facebook Pages");
        }
      })
      .catch(() => setError("Could not load Facebook Pages"));
  }, []);

  async function connect(pageId: string) {
    setBusy(pageId);
    setError(null);
    const res = await fetch("/api/facebook/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
    });
    const payload = await res.json().catch(() => ({}));
    setBusy(null);

    if (!payload.success) {
      setError(payload.error ?? "Could not connect the Page");
      return;
    }
    if (payload.data.warnings?.length) {
      setNotice(`Connected with warnings: ${payload.data.warnings.join("; ")}`);
    } else {
      window.location.reload();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facebook Pages</CardTitle>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Megaphone className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
        </span>
      </CardHeader>
      <p className="text-sm text-muted">
        Reply to keyword comments on your Page and its ads with a Messenger DM,
        a public reply and a like.
      </p>

      {tokenMissing ? (
        <p className="mt-4 rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">
          Add a system user token as META_ENGAGEMENT_ACCESS_TOKEN, with the
          Page assigned and these permissions: pages_show_list,
          pages_read_engagement, pages_manage_engagement,
          pages_manage_metadata, pages_messaging.
        </p>
      ) : error ? (
        <p className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      {notice && (
        <p className="mt-4 rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">
          {notice}
        </p>
      )}

      {pages === null && !error ? (
        <div className="mt-4 h-12 animate-pulse rounded-xl bg-surface-2" />
      ) : pages && pages.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          The token manages no Pages yet. Assign the Page to the system user in
          Meta Business settings.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {pages?.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3"
            >
              <span className="truncate text-sm font-semibold text-foreground">
                {page.name}
              </span>
              {page.connected ? (
                <Badge tone="success">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Connected
                </Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connect(page.id)}
                  disabled={busy !== null}
                >
                  {busy === page.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Connecting…
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
