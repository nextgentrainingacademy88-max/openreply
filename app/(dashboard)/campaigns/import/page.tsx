"use client";

/**
 * Import Campaigns Page
 *
 * Paste a CSV of everything except the post. Each row is queued and opened in
 * the campaign builder prefilled and editable, one at a time, so you review
 * each campaign and pick its reel before saving.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Upload } from "lucide-react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { parseCsv } from "@/lib/utils/csv";
import { IMPORT_QUEUE_KEY, IMPORT_ACCOUNT_KEY } from "@/lib/import-queue";
import { Button, Card, PageHeader, Textarea } from "@/components/ui";

const SAMPLE = `keywords,dm_message,public_reply,tracked_url,opening_dm,opening_dm_button
"yc","here it is: {link}","sent. check dms","https://events.ycombinator.com/startup-school-2026","hey! click below for the referral","send link"
"LINK,SHOP","grab it here: {link}","dmed u",,,`;

export default function ImportCampaignsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) {
          const next = payload.data.instagramAccounts ?? [];
          setAccounts(next);
          setSelectedAccountId(next[0]?.id ?? "");
        }
      })
      .catch(() => setAccounts([]));
  }, []);

  function startImport() {
    setError(null);
    const parsed = parseCsv(csv);
    if (parsed.length === 0) {
      setError("Paste a CSV with a header row and at least one campaign.");
      return;
    }

    const rows = [];
    for (let i = 0; i < parsed.length; i++) {
      const r = parsed[i];
      const keywords = (r.keywords ?? "")
        .split(/[,;]/)
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10);
      const dmMessage = (r.dm_message ?? r.message ?? "").trim();
      if (keywords.length === 0 || !dmMessage) {
        setError(`Row ${i + 1} is missing keywords or a message.`);
        return;
      }
      rows.push({
        name: (r.name ?? "").trim(),
        keywords,
        dmMessage,
        publicReply: (r.public_reply ?? "").trim(),
        trackedUrl: (r.tracked_url ?? "").trim(),
        openingDmMessage: (r.opening_dm ?? "").trim(),
        openingDmButtonLabel: (r.opening_dm_button ?? "").trim(),
      });
    }

    try {
      window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(rows));
      if (selectedAccountId) {
        window.localStorage.setItem(IMPORT_ACCOUNT_KEY, selectedAccountId);
      }
    } catch {
      setError("Could not stage the import in this browser.");
      return;
    }
    router.push("/campaigns/new");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 sm:space-y-8">
      <PageHeader
        title="Import campaigns"
        description={
          <>
            Paste a CSV with one row per campaign. Each row opens in the builder
            prefilled and editable, so you can review it and pick the reel before
            saving. Required columns are{" "}
            <code className="text-accent">keywords</code> and{" "}
            <code className="text-accent">dm_message</code>. Optional:{" "}
            <code className="text-accent">name</code>,{" "}
            <code className="text-accent">public_reply</code>,{" "}
            <code className="text-accent">tracked_url</code>,{" "}
            <code className="text-accent">opening_dm</code>,{" "}
            <code className="text-accent">opening_dm_button</code>. Keywords go in
            one cell, separated by commas. Use{" "}
            <code className="text-accent">{"{link}"}</code> in the message to
            insert the tracked link.
          </>
        }
      />

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <Card className="space-y-6">
        {accounts.length > 1 && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Instagram account
            </label>
            <AccountSelect
              accounts={accounts}
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              includeAll={false}
              label="Account"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">CSV</label>
          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={SAMPLE}
            rows={10}
            className="font-mono"
          />
          <button
            type="button"
            onClick={() => setCsv(SAMPLE)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Fill with a sample
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={startImport} variant="primary">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Review and import
          </Button>
          <Button onClick={() => router.push("/campaigns")} variant="secondary">
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
