import { Download } from "lucide-react"
import { downloadSeries } from "../format"

const PRESETS = [
  ["Month", "2026-01-01", "2026-01-31"],
  ["1–7", "2026-01-01", "2026-01-07"],
  ["8–14", "2026-01-08", "2026-01-14"],
  ["15–21", "2026-01-15", "2026-01-21"],
  ["22–28", "2026-01-22", "2026-01-28"],
  ["29–31", "2026-01-29", "2026-01-31"],
]

const FALLBACK_GATES = [
  { id: "09:20", market: "EPEX SPOT", name: "GB 60-min", detail: "Order book closes 09:20 UTC." },
  { id: "09:50", market: "N2EX", name: "Day-ahead hourly", detail: "Order book closes 09:50 UTC." },
  { id: "11:00", market: "Reference", name: "11:00 UTC", detail: "Reference gate from the brief." },
  { id: "12:00", market: "Reference", name: "12:00 UTC", detail: "Reference gate from the brief." },
  { id: "15:30", market: "EPEX SPOT", name: "GB 30-min", detail: "Half-hour auction closes 15:30 UTC." },
]

export default function Controls({ start, end, gate, gates, points, onStart, onEnd, onRange, onGate }) {
  const options = gates?.length ? gates : FALLBACK_GATES
  const active = options.find((item) => item.id === gate)

  return (
    <section className="panel space-y-4 px-4 py-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="kicker">Delivery window</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map(([label, presetStart, presetEnd]) => {
              const selected = start === presetStart && end === presetEnd
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onRange(presetStart, presetEnd)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    selected ? "bg-foam text-ink" : "bg-ink text-mist hover:text-foam"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-mist">
            From
            <input
              className="mt-1 block rounded-lg border border-line bg-ink px-3 py-2 text-sm text-foam"
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={start}
              onChange={(event) => onStart(event.target.value)}
            />
          </label>
          <label className="text-xs text-mist">
            To
            <input
              className="mt-1 block rounded-lg border border-line bg-ink px-3 py-2 text-sm text-foam"
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={end}
              onChange={(event) => onEnd(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => downloadSeries(points, start, end, gate)}
            disabled={!points?.length}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-mist hover:text-foam disabled:opacity-40"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        </div>
      </div>

      <div>
        <p className="kicker">Gate closure on D−1</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = option.id === gate
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onGate(option.id)}
                className={`rounded-xl border px-3 py-2 text-left ${
                  selected ? "border-gate bg-gate/15 text-foam" : "border-line bg-ink text-mist hover:text-foam"
                }`}
              >
                <span className="block font-mono text-sm">{option.id} UTC</span>
                <span className="block text-[11px] uppercase tracking-wide">
                  {option.market} · {option.name}
                </span>
              </button>
            )
          })}
        </div>
        {active && <p className="mt-2 text-sm text-mist">{active.detail}</p>}
      </div>
    </section>
  )
}
