/**
 * Stat Card
 *
 * Metric panel with label, value, and optional trend.
 *
 * Kept as its own file/export (default, label/value/trend/trendUp) so every
 * existing page importing `@/components/stat-card` keeps working untouched.
 * New code should prefer `StatCard` from `@/components/ui`
 * (label/value/icon?/hint?) — a different shape (icon slot instead of a
 * trend string), so this isn't just an alias of it.
 */

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
}

export default function StatCard({ label, value, trend, trendUp }: StatCardProps) {
  return (
    <div className="panel p-5 sm:p-6">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs font-medium ${trendUp ? "text-success" : "text-error"}`}>
          {trendUp ? "Up" : "Down"} {trend}
        </p>
      )}
    </div>
  );
}
