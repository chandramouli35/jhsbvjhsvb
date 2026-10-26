export function decorateSeries(points, vintages = []) {
  let running = 0
  return points.map((point, index) => {
    if (point.shortfall_mwh != null) running += point.shortfall_mwh
    if (point.surplus_mwh != null) running -= point.surplus_mwh
    const row = {
      ...point,
      surplus_plot: point.surplus_mw == null ? null : -point.surplus_mw,
      cumulative_net_mwh: point.day_ahead_mw == null ? null : running,
    }
    vintages.forEach((vintage, vintageIndex) => {
      row[`vintage_${vintageIndex}`] = vintage.mw[index]
    })
    return row
  })
}
