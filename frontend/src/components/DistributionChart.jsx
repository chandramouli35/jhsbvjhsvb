import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { axisTick } from "../chartTheme"
import { formatCompactMw, formatCount, formatPower } from "../format"
import TooltipCard from "./TooltipCard"

export default function DistributionChart({ distribution }) {
  const data = (distribution || []).map((bin) => ({
    ...bin,
    label: formatCompactMw((bin.bin_start_mw + bin.bin_end_mw) / 2),
  }))

  return (
    <section className="panel px-3 py-4 md:px-4">
      <div className="px-2">
        <p className="kicker">Error distribution</p>
        <h2 className="mt-1 font-serif text-2xl text-foam">Forecast minus actual</h2>
        <p className="mt-1 text-sm text-mist">Positive bins are hours where thermal plant had to cover a wind shortfall.</p>
      </div>
      <div className="mt-3 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#214056" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: "#214056" }} tickLine={false} />
            <YAxis tick={axisTick} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              cursor={{ fill: "rgba(227,179,65,0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const bin = payload[0].payload
                return (
                  <TooltipCard
                    title="Gate error"
                    rows={[
                      { label: "From", value: formatPower(bin.bin_start_mw) },
                      { label: "To", value: formatPower(bin.bin_end_mw) },
                      { label: "Periods", value: formatCount(bin.count) },
                    ]}
                  />
                )
              }}
            />
            <Bar dataKey="count" name="Periods" fill="#e3b341" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
