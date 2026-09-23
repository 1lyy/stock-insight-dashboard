export const EXAMPLE_QUERIES = [
  {
    id: 'demo-001',
    query: '分析 A 公司最近 30 天的股价和成交量，并标出跌幅最大的 3 个交易日。',
  },
  {
    id: 'demo-002',
    query: '查看 B 公司最近 10 个交易日的收盘价走势。',
  },
  {
    id: 'demo-003',
    query: '用柱状图展示 A 公司最近 20 个交易日的成交量。',
  },
  {
    id: 'demo-004',
    query: '比较 C 公司最近 15 个交易日的涨跌幅，并标出涨幅最大的 3 天。',
  },
  {
    id: 'demo-005',
    query: '展示 B 公司 2025-03-03 到 2025-03-28 的收盘价和成交量。',
  },
] as const

export type ExampleQuery = (typeof EXAMPLE_QUERIES)[number]
