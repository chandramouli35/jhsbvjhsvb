import { useMemo } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { axisTick, chartMargin } from "../chartTheme"
import { axisInterval, formatEnergy, formatPower, formatSettlement, tickLabel } from "../format"
import { decorateSeries } from "../series"
import TooltipCard from "./TooltipCard"

export default function ProcurementChart({ points }) {
  const data = useMemo(() => decorateSeries(points), [points])

  return (
    <section className="panel px-3 py-4 md:px-4">
      <div className="px-2">
        <p className="kicker">Procurement gap</p>
        <h2 className="mt-1 font-serif text-2xl text-foam">Thermal backup against the gate position</h2>
        <p className="mt-1 max-w-3xl text-sm text-mist">
          Coral is wind the day-ahead desk counted on and did not receive. That volume has to be bought from thermal or balancing plant.
          Green is wind that arrived above the gate forecast.
        </p>
      </div>
      <div className="mt-3 h-[280px] md:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={chartMargin()} syncId="settlement">
            <defs>
              <linearGradient id="shortfallFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f07167" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#f07167" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="surplusFill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#2fceb0" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#2fceb0" stopOpacity={0.05} />
              </linearGradient>
            </defs>
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
              yAxisId="power"
              tick={axisTick}
              tickFormatter={(value) => formatPower(value).replace(" MW", "")}
              width={58}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="energy"
              orientation="right"
              tick={axisTick}
              tickFormatter={(value) => formatEnergy(value).replace(" TWh", "T").replace(" GWh", "G").replace(" MWh", "")}
              width={56}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine yAxisId="power" y={0} stroke="#93a8ba" strokeDasharray="3 3" />
            <Tooltip content={<ProcurementTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#93a8ba" }} />
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="shortfall_mw"
              name="Shortfall"
              stroke="#f07167"
              fill="url(#shortfallFill)"
              isAnimationActive={false}
            />
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="surplus_plot"
              name="Surplus"
              stroke="#2fceb0"
              fill="url(#surplusFill)"
              isAnimationActive={false}
            />
            <Line
              yAxisId="energy"
              type="monotone"
              dataKey="cumulative_net_mwh"
              name="Cumulative net"
              stroke="#e7eef5"
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function ProcurementTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <TooltipCard
      title={formatSettlement(point.start_time, point.settlement_period)}
      rows={[
        { label: "Shortfall", value: formatPower(point.shortfall_mw) },
        { label: "Thermal energy", value: formatEnergy(point.shortfall_mwh) },
        { label: "Surplus", value: formatPower(point.surplus_mw) },
        { label: "Cumulative net", value: formatEnergy(point.cumulative_net_mwh) },
      ]}
    />
  )
}
