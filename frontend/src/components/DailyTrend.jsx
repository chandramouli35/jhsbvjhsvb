import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { axisTick } from "../chartTheme"
import { formatDay, formatEnergy, formatPower, formatSignedPower } from "../format"
import TooltipCard from "./TooltipCard"

export default function DailyTrend({ daily, onSelectDay }) {
  const data = (daily || []).map((row) => ({ ...row, label: formatDay(row.date) }))
  const worst = [...data].sort((left, right) => right.mae_mw - left.mae_mw)[0]

  return (
    <section className="panel px-3 py-4 md:px-4">
      <div className="px-2">
        <p className="kicker">Daily accuracy</p>
        <h2 className="mt-1 font-serif text-2xl text-foam">MAE and bias by delivery day</h2>
        <p className="mt-1 text-sm text-mist">
          {worst ? `Widest miss: ${worst.label}, MAE ${formatPower(worst.mae_mw)}. Select a bar to open that day.` : "Select a bar to open that day."}
        </p>
      </div>
      <div className="mt-3 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#214056" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} interval={data.length > 16 ? 1 : 0} axisLine={{ stroke: "#214056" }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload
                return (
                  <TooltipCard
                    title={row.label}
                    rows={[
                      { label: "MAE", value: formatPower(row.mae_mw) },
                      { label: "Bias", value: formatSignedPower(row.bias_mw) },
                      { label: "Shortfall", value: formatEnergy(row.shortfall_mwh) },
                    ]}
                  />
                )
              }}
            />
            <Bar
              dataKey="mae_mw"
              name="MAE"
              fill="#8eb7ff"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(entry) => {
                const day = entry?.date || entry?.payload?.date
                if (day) onSelectDay(day)
              }}
            />
            <Line
              type="monotone"
              dataKey="bias_mw"
              name="Bias"
              stroke="#f07167"
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
