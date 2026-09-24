"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, CardTitle, Input } from "@/components/ui";

export function PasswordCard() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings/password")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setHasPassword(Boolean(payload.data.hasPassword));
      })
      .catch(() => setHasPassword(false));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);

    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const payload = await res.json();

    if (payload.success) {
      setSuccess(true);
      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setError(payload.error ?? "Could not update password");
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        {hasPassword !== null && (
          <Badge tone={hasPassword ? "success" : "warning"}>
            {hasPassword ? "Set" : "Not set"}
          </Badge>
        )}
      </CardHeader>

      <p className="mb-5 text-sm text-muted">
        {hasPassword
          ? "Change the password you use to sign in, instead of waiting on an email link every time."
          : "Set a password so you can sign in directly, instead of waiting on an email link every time."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {hasPassword && (
          <div className="space-y-2">
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-foreground"
            >
              Current password
            </label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-foreground"
          >
            New password
          </label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={200}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-foreground"
          >
            Confirm new password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={200}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
        {success && (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Password updated.
          </p>
        )}

        <Button type="submit" disabled={busy || hasPassword === null}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {hasPassword ? "Update password" : "Set password"}
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
