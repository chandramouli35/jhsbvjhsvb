import { useMemo, useState } from "react"
import { formatPower, formatSignedPower } from "../format"

export default function Heatmap({ periods }) {
  const [mode, setMode] = useState("bias")
  const byPeriod = useMemo(() => new Map((periods || []).map((row) => [row.settlement_period, row])), [periods])
  const values = (periods || []).map((row) => (mode === "bias" ? row.bias_mw : row.mae_mw)).filter((value) => Number.isFinite(value))
  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 1)

  return (
    <section className="panel px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Settlement-period heatmap</p>
          <h2 className="mt-1 font-serif text-2xl text-foam">Where in the day the gate misses</h2>
          <p className="mt-1 text-sm text-mist">
            {mode === "bias"
              ? "Red means the forecast ran high at that half-hour and thermal cover was needed. Green means surplus wind."
              : "Brighter brass means a larger absolute miss at that half-hour, averaged over the selected days."}
          </p>
        </div>
        <div className="flex gap-2">
          {[
            ["bias", "Bias"],
            ["mae", "MAE"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-full px-3 py-1 text-sm ${mode === id ? "bg-foam text-ink" : "bg-ink text-mist"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid items-center gap-1" style={{ gridTemplateColumns: "52px repeat(24, minmax(0, 1fr))" }}>
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-center font-mono text-[10px] text-mist">
                {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
              </span>
            ))}
            {[0, 30].map((minute) => (
              <HourRow
                key={minute}
                minute={minute}
                byPeriod={byPeriod}
                mode={mode}
                maxAbs={maxAbs}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function HourRow({ minute, byPeriod, mode, maxAbs }) {
  return (
    <>
      <span className="font-mono text-[10px] text-mist">:{String(minute).padStart(2, "0")}</span>
      {Array.from({ length: 24 }, (_, hour) => {
        const period = hour * 2 + (minute === 30 ? 2 : 1)
        const row = byPeriod.get(period)
        const value = row ? (mode === "bias" ? row.bias_mw : row.mae_mw) : null
        const title = row
          ? `SP ${period} ${row.label} UTC · bias ${formatSignedPower(row.bias_mw)} · MAE ${formatPower(row.mae_mw)}`
          : `SP ${period}`
        return (
          <div
            key={period}
            title={title}
            className="h-8 rounded-sm"
            style={{ background: cellColor(value, mode, maxAbs) }}
          />
        )
      })}
    </>
  )
}

function cellColor(value, mode, maxAbs) {
  if (!Number.isFinite(value)) return "#102433"
  if (mode === "mae") {
    const strength = 0.15 + (value / maxAbs) * 0.85
    return `rgba(227, 179, 65, ${strength})`
  }
  const scaled = Math.max(-1, Math.min(1, value / maxAbs))
  const strength = 0.16 + Math.abs(scaled) * 0.84
  return scaled >= 0 ? `rgba(240, 113, 103, ${strength})` : `rgba(47, 206, 176, ${strength})`
}
