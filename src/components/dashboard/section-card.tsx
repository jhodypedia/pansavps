import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn("overflow-hidden rounded-2xl border border-[#E3E8E4] bg-white", className)}
    >
      {title || action ? (
        <header className="flex flex-col gap-2 border-b border-[#EDF1EE] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-bold text-[#101613]">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-[#5B6B60]">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function InfoRow({
  label,
  value,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2.5", className)}>
      <dt className="text-sm text-[#5B6B60]">{label}</dt>
      <dd className="max-w-[65%] text-right text-sm font-semibold break-words text-[#101613]">
        {value}
        {hint ? <span className="mt-0.5 block text-xs font-normal text-[#8A9A90]">{hint}</span> : null}
      </dd>
    </div>
  );
}
