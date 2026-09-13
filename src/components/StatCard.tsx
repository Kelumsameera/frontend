interface Props {
  title: string;
  value: number | string;
  unit?: string;
  className?: string;
  icon?: React.ReactNode;
}

export default function StatCard({ title, value, unit = "", className = "", icon }: Props) {
  const display = typeof value === "number" ? value.toFixed(2) : value;

  return (
    <div
      className={`group relative bg-(--panel) p-5 lg:p-6 rounded-2xl border border-(--border) shadow-[0_1px_2px_rgba(15,39,69,0.04),0_10px_24px_rgba(15,39,69,0.05)] hover:shadow-[0_1px_2px_rgba(15,39,69,0.06),0_14px_32px_rgba(15,39,69,0.09)] hover:-translate-y-0.5 transition-all duration-200 flex-1 min-w-[200px] overflow-hidden ${className}`}
    >
      <span className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-(--primary-soft) opacity-70 group-hover:scale-110 transition-transform duration-300" />
      <div className="relative flex items-start justify-between">
        <div className="text-(--text-muted) text-[13px] font-medium tracking-wide">{title}</div>
        {icon && <div className="text-(--primary) text-lg">{icon}</div>}
      </div>
      <div className="relative text-2xl lg:text-[28px] font-bold mt-2 text-(--text) font-mono-data">
        {display}
        {unit && <span className="text-base font-semibold text-(--text-faint) ml-1">{unit}</span>}
      </div>
    </div>
  );
}
