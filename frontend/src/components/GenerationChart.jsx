import { useMemo } from "react"
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Brush,
} from "recharts"
import { axisTick, chartMargin } from "../chartTheme"
import { axisInterval, formatPower, formatSettlement, formatSignedPower, formatClock, tickLabel } from "../format"
import { decorateSeries } from "../series"
import TooltipCard from "./TooltipCard"

export default function GenerationChart({ points, vintages }) {
  const data = useMemo(() => decorateSeries(points, vintages), [points, vintages])
  const vintageKeys = (vintages || []).map((_, index) => `vintage_${index}`)

  return (
    <section className="panel px-3 py-4 md:px-4">
      <div className="px-2">
        <p className="kicker">Settlement periods · 30 minutes</p>
        <h2 className="mt-1 font-serif text-2xl text-foam">Metered wind against the gate forecast</h2>
        <p className="mt-1 text-sm text-mist">
          Faint lines are the other WINDFOR publications in this window. They appear when the range is three days or shorter.
        </p>
      </div>
      <div className="mt-3 h-[340px] md:h-[430px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={chartMargin()} syncId="settlement">
            <CartesianGrid stroke="#214056" vertical={false} />
            <XAxis
              dataKey="start_time"
              tick={axisTick}
              tickFormatter={(value) => tickLabel(value, data.length)}
              interval={axisInterval(data.length)}
              minTickGap={16}
              axisLine={{ stroke: "#214056" }}
              tickLine={false}
            />
            <YAxis
              tick={axisTick}
              tickFormatter={(value) => formatPower(value).replace(" MW", "")}
              width={58}
              axisLine={false}
              tickLine={false}
              label={{ value: "MW", angle: -90, position: "insideLeft", fill: "#93a8ba", fontSize: 11 }}
            />
            <Tooltip content={<GenerationTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#93a8ba" }} />
            {vintageKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={index === 0 ? "Other runs" : undefined}
                stroke="#5d7486"
                strokeWidth={1}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                legendType={index === 0 ? "line" : "none"}
              />
            ))}
            <Line
              type="monotone"
              dataKey="intraday_mw"
              name="Intraday revision"
              stroke="#8eb7ff"
              strokeWidth={1.4}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="day_ahead_mw"
              name="Gate forecast"
              stroke="#e3b341"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual_mw"
              name="Actual wind"
              stroke="#2fceb0"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Brush
              dataKey="start_time"
              height={22}
              travellerWidth={8}
              tickFormatter={() => ""}
              stroke="#214056"
              fill="#0d1c28"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function GenerationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <TooltipCard
      title={formatSettlement(point.start_time, point.settlement_period)}
      rows={[
        { label: "Actual", value: formatPower(point.actual_mw) },
        { label: "Gate forecast", value: `${formatPower(point.day_ahead_mw)} · ${formatClock(point.day_ahead_publish_time)}` },
        {
          label: "Intraday",
          value: point.intraday_mw == null ? "—" : `${formatPower(point.intraday_mw)} · ${formatClock(point.intraday_publish_time)}`,
        },
        { label: "Error", value: formatSignedPower(point.error_mw) },
      ]}
    />
  )
}
