import { formatEnergy, formatPercent, formatSignedPower, formatPower } from "../format"

export default function GateCompare({ rows, gate, onGate }) {
  if (!rows?.length) return null
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-end justify-between gap-3 px-4 py-3">
        <div>
          <p className="kicker">Same window, different auction</p>
          <h2 className="mt-1 font-serif text-2xl text-foam">What each gate was allowed to see</h2>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-mist">
            <tr className="border-y border-line">
              <th className="px-4 py-2 font-medium">Gate</th>
              <th className="px-3 py-2 font-medium">Market</th>
              <th className="px-3 py-2 font-medium">Vintage used</th>
              <th className="px-3 py-2 text-right font-medium">MAE</th>
              <th className="px-3 py-2 text-right font-medium">Bias</th>
              <th className="px-3 py-2 text-right font-medium">MAPE</th>
              <th className="px-4 py-2 text-right font-medium">Thermal energy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.gate === gate
              return (
                <tr
                  key={row.gate}
                  onClick={() => onGate(row.gate)}
                  className={`cursor-pointer border-b border-line/70 ${selected ? "bg-gate/10" : "hover:bg-white/5"}`}
                >
                  <td className="px-4 py-2.5 font-mono text-foam">{row.gate}</td>
                  <td className="px-3 py-2.5 text-mist">
                    {row.market}
                    <span className="block text-xs">{row.name}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-gate">{row.vintage ? `${row.vintage} UTC` : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatPower(row.mae_mw)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatSignedPower(row.bias_mw)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatPercent(row.mape_pct)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-short">{formatEnergy(row.shortfall_mwh)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
