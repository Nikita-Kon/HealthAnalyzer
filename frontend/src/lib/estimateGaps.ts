/** Visual-only gap estimates based on the last two observed values, never future values. */
export function estimateGaps(series: (number | null)[], domain?: [number, number]) {
  const estimated: (number | null)[] = series.map(() => null)
  let previous: { day: number; value: number } | null = null
  let latest: { day: number; value: number } | null = null
  series.forEach((value, day) => {
    if (value != null) {
      if (day > 0 && estimated[day - 1] != null) estimated[day] = value
      previous = latest
      latest = { day, value }
    } else if (previous && latest) {
      const slope = (latest.value - previous.value) / (latest.day - previous.day)
      const value = latest.value + slope * (day - latest.day)
      estimated[day] = Math.min(domain?.[1] ?? Infinity, Math.max(domain?.[0] ?? 0, value))
      if (day === latest.day + 1) estimated[latest.day] = latest.value
    }
  })
  return estimated
}
