import { useMemo, useState } from "react"
import { formatDay, formatEnergy, formatPercent, formatPower, formatSignedPower, formatWeekday } from "../format"

const COLUMNS = [
  ["date", "Date", false],
  ["actual_mwh", "Actual", true],
  ["forecast_mwh", "Gate forecast", true],
  ["bias_mw", "Bias", true],
  ["mae_mw", "MAE", true],
  ["rmse_mw", "RMSE", true],
  ["mape_pct", "MAPE", true],
  ["shortfall_mwh", "Shortfall", true],
  ["surplus_mwh", "Surplus", true],
]

export default function DailyTable({ daily, onSelectDay }) {
  const [sort, setSort] = useState({ key: "date", dir: "asc" })
  const rows = useMemo(() => {
    const copy = [...(daily || [])]
    copy.sort((left, right) => {
      const leftValue = left[sort.key]
      const rightValue = right[sort.key]
      if (leftValue === rightValue) return 0
      const order = leftValue > rightValue ? 1 : -1
      return sort.dir === "asc" ? order : -order
    })
    return copy
  }, [daily, sort])

  function toggle(key) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "date" ? "asc" : "desc" },
    )
  }

  return (
    <section className="panel overflow-hidden">
      <div className="px-4 py-3">
        <p className="kicker">Daily breakdown</p>
        <h2 className="mt-1 font-serif text-2xl text-foam">Energy, error, and the gap to close</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-mist">
            <tr className="border-y border-line">
              {COLUMNS.map(([key, label, numeric]) => (
                <th key={key} className={`px-3 py-2 font-medium ${numeric ? "text-right" : "px-4"}`}>
                  <button type="button" onClick={() => toggle(key)} className="uppercase tracking-wide">
                    {label}
                    {sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.date}
                onClick={() => onSelectDay(row.date)}
                className="cursor-pointer border-b border-line/70 hover:bg-white/5"
              >
                <td className="px-4 py-2 text-foam">
                  {formatWeekday(row.date)} {formatDay(row.date)}
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatEnergy(row.actual_mwh)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatEnergy(row.forecast_mwh)}</td>
                <td className={`px-3 py-2 text-right font-mono ${row.bias_mw > 0 ? "text-short" : "text-wind"}`}>
                  {formatSignedPower(row.bias_mw)}
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatPower(row.mae_mw)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPower(row.rmse_mw)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPercent(row.mape_pct)}</td>
                <td className="px-3 py-2 text-right font-mono text-short">{formatEnergy(row.shortfall_mwh)}</td>
                <td className="px-3 py-2 text-right font-mono text-wind">{formatEnergy(row.surplus_mwh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
