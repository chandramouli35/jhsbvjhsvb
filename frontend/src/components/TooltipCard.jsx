export default function TooltipCard({ title, rows }) {
  return (
    <div className="rounded-lg border border-line bg-ink/95 px-3 py-2 text-xs shadow-desk">
      <p className="mb-1.5 max-w-[280px] font-medium text-foam">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-6">
            <span className="text-mist">{row.label}</span>
            <span className="font-mono text-foam">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
