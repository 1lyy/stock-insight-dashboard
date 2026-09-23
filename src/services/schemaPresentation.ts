import type { DashboardSchemaV1 } from '../domain/schema/dashboardSchema'
import { METRIC_DEFINITIONS, type MetricId } from '../domain/metrics'

export function normalizeInstruction(input: string): string {
  return input.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

export function createStableRequestId(seed: string): string {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return `demo-${String(hash >>> 0).slice(-3).padStart(3, '0')}`
}

export function createMetricSpec(id: MetricId): DashboardSchemaV1['metrics'][number] {
  const definition = METRIC_DEFINITIONS[id]
  return { id, label: definition.label, unit: definition.unit }
}

export function createChartTitle(
  stockName: string,
  timeRange: DashboardSchemaV1['timeRange'],
  metricId: MetricId,
): string {
  const rangeTitle = timeRange.mode === 'lastTradingDays'
    ? `${stockName}最近 ${timeRange.tradingDays} 个交易日`
    : `${stockName} ${timeRange.start} 至 ${timeRange.end} `
  return `${rangeTitle}${METRIC_DEFINITIONS[metricId].label}`
}

export function createChartId(metricId: MetricId, type: 'line' | 'bar'): string {
  if (metricId === 'close') return type === 'line' ? 'price-trend' : 'price-bars'
  if (metricId === 'volume') return type === 'line' ? 'volume-trend' : 'volume-bars'
  return type === 'line' ? 'change-trend' : 'change-bars'
}
