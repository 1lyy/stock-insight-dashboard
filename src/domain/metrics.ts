export const METRIC_DEFINITIONS = {
  close: {
    id: 'close',
    label: '收盘价',
    unit: '元',
    precision: 2,
    source: 'close',
    defaultChartType: 'line',
  },
  volume: {
    id: 'volume',
    label: '成交量',
    unit: '股',
    precision: 0,
    source: 'volume',
    defaultChartType: 'bar',
  },
  changePct: {
    id: 'changePct',
    label: '涨跌幅',
    unit: '%',
    precision: 2,
    source: 'derived',
    formula: '(close[t] - close[t-1]) / close[t-1] * 100',
    defaultChartType: 'line',
  },
} as const

export type MetricId = keyof typeof METRIC_DEFINITIONS

export const METRIC_IDS = Object.keys(METRIC_DEFINITIONS) as [MetricId, ...MetricId[]]
