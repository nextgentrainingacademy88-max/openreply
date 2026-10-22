"use client";

import { Select } from "@/components/ui";

export interface AccountOption {
  id: string;
  username: string;
  instagramId: string;
  name?: string | null;
  platform?: "INSTAGRAM" | "FACEBOOK";
}

/** How an account reads in a picker: @handle for Instagram, name for a Page. */
export function accountLabel(account: AccountOption): string {
  return account.platform === "FACEBOOK"
    ? `${account.name ?? account.username} (Facebook Page)`
    : `@${account.username}`;
}

interface AccountSelectProps {
  accounts: AccountOption[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  label?: string;
}

export default function AccountSelect({
  accounts,
  value,
  onChange,
  includeAll = true,
  label = "Instagram account",
}: AccountSelectProps) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-52"
      >
        {includeAll && <option value="all">All accounts</option>}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {accountLabel(account)}
          </option>
        ))}
      </Select>
    </label>
  );
}
