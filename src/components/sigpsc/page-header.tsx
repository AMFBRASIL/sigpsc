import type { ReactNode } from "react";
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export function Panel({ title, action, children, className = "" }: { title?: string | undefined; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card shadow-card ${className}`}>
      {title && <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5"><h2 className="font-display text-sm font-semibold text-card-foreground">{title}</h2>{action}</div>}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
