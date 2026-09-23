import type { AppError } from '../domain/errors'
import {
  DATA_AS_OF,
  DATA_END_DATE,
  DATASET_VERSION,
  MARKET_TIMEZONE,
  MAX_ANNOTATION_COUNT,
  MAX_TRADING_DAYS,
  MIN_ANNOTATION_COUNT,
  MIN_TRADING_DAYS,
  SCHEMA_VERSION,
} from '../domain/datePolicy'
import { isoDateSchema } from '../domain/isoDate'
import type { MetricId } from '../domain/metrics'
import { failure, success, type OperationResult } from '../domain/result'
import {
  dashboardSchemaV1,
  type DashboardSchemaV1,
} from '../domain/schema/dashboardSchema'
import { EXAMPLE_QUERIES } from '../domain/schema/examples'
import { LocalMockDataProvider } from '../infrastructure/LocalMockDataProvider'
import type { StockSymbol } from '../infrastructure/DataProvider'
import {
  createChartId,
  createChartTitle,
  createMetricSpec,
  createStableRequestId,
  normalizeInstruction,
} from './schemaPresentation'

interface ParseOptions {
  readonly requestId?: string
}

interface ParsedAnnotation {
  readonly kind: 'topN' | 'bottomN'
  readonly metricId: 'changePct' | 'volume'
  readonly count: number
}

const STOCKS = [
  { symbol: 'MOCK-A', name: 'A 公司', aliases: [/A\s*公司/i, /MOCK-A/i] },
  { symbol: 'MOCK-B', name: 'B 公司', aliases: [/B\s*公司/i, /MOCK-B/i] },
  { symbol: 'MOCK-C', name: 'C 公司', aliases: [/C\s*公司/i, /MOCK-C/i] },
] as const

const UNSUPPORTED_METRIC_PATTERN = /(市盈率|市净率|市值|换手率|净利润|每股收益)/

function parserError(
  code: AppError['code'],
  message: string,
  suggestion: string,
  fieldPath?: string,
): OperationResult<never> {
  return failure({
    code,
    stage: 'understanding',
    message,
    suggestion,
    ...(fieldPath ? { fieldPath } : {}),
  })
}

function stableRequestId(query: string): string {
  const matchingExample = EXAMPLE_QUERIES.find((example) => normalizeInstruction(example.query) === query)
  if (matchingExample) return matchingExample.id
  return createStableRequestId(query)
}

function parseStock(query: string): OperationResult<(typeof STOCKS)[number]> {
  const matches = STOCKS.filter((stock) => stock.aliases.some((alias) => alias.test(query)))
  if (matches.length === 1 && matches[0]) return success(matches[0])
  if (matches.length > 1) {
    return parserError('UNKNOWN_STOCK', '指令中包含多个股票，当前版本一次只支持一只。', '请只保留 A、B、C 公司中的一家。')
  }

  const unknownCompany = query.match(/(?:MOCK-)?([A-Z])\s*公司?/i)?.[0]
  return parserError(
    'UNKNOWN_STOCK',
    unknownCompany ? `暂不支持股票“${unknownCompany}”。` : '没有识别到股票。',
    '可使用：A 公司、B 公司、C 公司，或代码 MOCK-A、MOCK-B、MOCK-C。',
    'stock',
  )
}

function parseDisplayedMetrics(query: string): MetricId[] {
  const metrics: MetricId[] = []
  if (/(收盘价|股价|价格)/.test(query)) metrics.push('close')
  if (/(成交量|交易量)/.test(query)) metrics.push('volume')
  if (/涨跌幅/.test(query)) metrics.push('changePct')
  return metrics
}

function parseAnnotation(query: string): OperationResult<ParsedAnnotation | undefined> {
  const matches = [...query.matchAll(/(涨跌幅|涨幅|跌幅|成交量|交易量)\s*(最大|最小|最高|最低)(?:的)?\s*(\d+)\s*(?:个)?(?:交易日|天)/g)]
  if (matches.length === 0) return success(undefined)
  if (matches.length > 1) {
    return parserError('AMBIGUOUS_FOLLOW_UP', '一条指令中包含多个极值要求。', '当前版本请一次只标注一组 Top N。')
  }

  const [metricText, directionText, countText] = matches[0]?.slice(1) ?? []
  const count = Number(countText)
  if (!Number.isInteger(count) || count < MIN_ANNOTATION_COUNT || count > MAX_ANNOTATION_COUNT) {
    return parserError(
      'INVALID_RANGE',
      `极值数量必须在 ${MIN_ANNOTATION_COUNT} 到 ${MAX_ANNOTATION_COUNT} 之间。`,
      '请修改“最大的 N 天”中的 N。',
      'charts.annotations.count',
    )
  }

  const metricId = metricText === '成交量' || metricText === '交易量' ? 'volume' : 'changePct'
  const isHigh = directionText === '最大' || directionText === '最高'
  const kind = metricText === '跌幅' ? (isHigh ? 'bottomN' : 'topN') : isHigh ? 'topN' : 'bottomN'
  return success({ kind, metricId, count })
}

function parseTimeRange(
  query: string,
  symbol: StockSymbol,
  provider: LocalMockDataProvider,
): OperationResult<DashboardSchemaV1['timeRange']> {
  const explicitMatches = [...query.matchAll(/(\d{4}-\d{2}-\d{2})\s*(?:到|至|~|～)\s*(\d{4}-\d{2}-\d{2})/g)]
  const recentMatches = [...query.matchAll(/最近\s*(\d+)\s*(?:个)?(?:交易日|天)/g)]
  const explicitMatch = explicitMatches[0]
  const recentMatch = recentMatches[0]

  if (explicitMatches.length + recentMatches.length > 1) {
    return parserError('AMBIGUOUS_QUERY', '检测到多个时间范围，无法确定使用哪一个。', '请只保留一种时间表达。')
  }

  if (explicitMatch) {
    const [, start, end] = explicitMatch
    if (!start || !end || !isoDateSchema.safeParse(start).success || !isoDateSchema.safeParse(end).success) {
      return parserError('INVALID_DATE_RANGE', '日期不是有效的 YYYY-MM-DD。', '例如：2025-03-03 到 2025-03-28。')
    }
    if (start > end) {
      return parserError('INVALID_DATE_RANGE', '开始日期晚于结束日期。', '请调整日期顺序。', 'timeRange.start')
    }
    return success({ mode: 'dateRange', start, end, timezone: MARKET_TIMEZONE })
  }

  if (recentMatch) {
    const tradingDays = Number(recentMatch[1])
    if (!Number.isInteger(tradingDays) || tradingDays < MIN_TRADING_DAYS || tradingDays > MAX_TRADING_DAYS) {
      return parserError(
        'INVALID_RANGE',
        `最近交易日数量必须在 ${MIN_TRADING_DAYS} 到 ${MAX_TRADING_DAYS} 之间。`,
        '请修改“最近 N 天”中的 N。',
        'timeRange.tradingDays',
      )
    }

    const availableDates = provider.getAvailableDates(symbol).filter((date) => date <= DATA_END_DATE)
    const start = availableDates.at(-tradingDays)
    const end = availableDates.at(-1)
    if (!start || !end) {
      return parserError('RANGE_OUT_OF_DATASET', '模拟数据不足以覆盖请求范围。', '请缩短时间范围。')
    }
    return success({ mode: 'lastTradingDays', start, end, tradingDays, timezone: MARKET_TIMEZONE })
  }

  return parserError(
    'MISSING_REQUIREMENT',
    '没有识别到时间范围。',
    '请使用“最近 10 个交易日”或“2025-03-03 到 2025-03-28”。',
    'timeRange',
  )
}

function createCharts(
  query: string,
  stockName: string,
  timeRange: DashboardSchemaV1['timeRange'],
  displayedMetrics: readonly MetricId[],
  annotation: ParsedAnnotation | undefined,
): DashboardSchemaV1['charts'] {
  const explicitChartType = query.includes('柱状图') ? 'bar' : query.includes('折线图') ? 'line' : undefined
  const charts = displayedMetrics.map((metricId): DashboardSchemaV1['charts'][number] => {
    if (metricId === 'close') {
      const type = explicitChartType ?? 'line'
      return {
        id: createChartId(metricId, type),
        type,
        title: createChartTitle(stockName, timeRange, metricId),
        metricIds: ['close'],
        xField: 'date',
        yFields: ['close'],
        annotations: [],
      }
    }
    if (metricId === 'volume') {
      const type = explicitChartType ?? 'bar'
      return {
        id: createChartId(metricId, type),
        type,
        title: createChartTitle(stockName, timeRange, metricId),
        metricIds: ['volume'],
        xField: 'date',
        yFields: ['volume'],
        annotations: [],
      }
    }

    const type = explicitChartType ?? (query.includes('比较') ? 'bar' : 'line')
    return {
      id: createChartId(metricId, type),
      type,
      title: createChartTitle(stockName, timeRange, metricId),
      metricIds: ['changePct'],
      xField: 'date',
      yFields: ['changePct'],
      annotations: [],
    }
  })

  if (annotation) {
    const targetMetric: MetricId = annotation.metricId === 'changePct' && displayedMetrics.includes('close')
      ? 'close'
      : annotation.metricId
    const chart = charts.find((candidate) => candidate.metricIds.includes(targetMetric))
    if (chart) chart.annotations.push(annotation)
  }

  return charts
}

export class IntentParser {
  constructor(private readonly provider = new LocalMockDataProvider()) {}

  parse(input: string, options: ParseOptions = {}): OperationResult<DashboardSchemaV1> {
    const query = normalizeInstruction(input)
    if (!query) return parserError('EMPTY_QUERY', '请输入分析需求。', '例如：查看 A 公司最近 10 个交易日的收盘价。')
    if (query.length > 200) return parserError('QUERY_TOO_LONG', '指令不能超过 200 个字符。', '请精简分析需求。')

    const stockResult = parseStock(query)
    if (!stockResult.ok) return stockResult

    const annotationResult = parseAnnotation(query)
    if (!annotationResult.ok) return annotationResult
    const annotation = annotationResult.value

    if (query.includes('柱状图') && query.includes('折线图')) {
      return parserError(
        'AMBIGUOUS_QUERY',
        '同时检测到柱状图和折线图要求。',
        '请只指定一种图表类型，或省略图表类型使用默认规则。',
        'charts.type',
      )
    }

    const unsupported = query.match(UNSUPPORTED_METRIC_PATTERN)?.[0]
    if (unsupported) {
      return parserError(
        'UNKNOWN_METRIC',
        `暂不支持指标“${unsupported}”。`,
        '可使用：收盘价（股价）、成交量（交易量）、涨跌幅。',
        'metrics',
      )
    }

    const displayedMetrics = parseDisplayedMetrics(query)
    if (displayedMetrics.length === 0 && annotation) displayedMetrics.push(annotation.metricId)
    if (displayedMetrics.length === 0) {
      return parserError(
        'MISSING_REQUIREMENT',
        '没有识别到分析指标。',
        '可使用：收盘价（股价）、成交量（交易量）、涨跌幅。',
        'metrics',
      )
    }

    const timeRangeResult = parseTimeRange(query, stockResult.value.symbol, this.provider)
    if (!timeRangeResult.ok) return timeRangeResult
    const timeRange = timeRangeResult.value

    const allMetricIds = [...displayedMetrics]
    if (annotation && !allMetricIds.includes(annotation.metricId)) allMetricIds.push(annotation.metricId)

    const candidate = {
      version: SCHEMA_VERSION,
      requestId: options.requestId ?? stableRequestId(query),
      stock: { symbol: stockResult.value.symbol, name: stockResult.value.name },
      timeRange,
      metrics: allMetricIds.map(createMetricSpec),
      charts: createCharts(query, stockResult.value.name, timeRange, displayedMetrics, annotation),
      dataSource: {
        type: 'mock',
        name: 'Built-in Mock Market Data',
        datasetVersion: DATASET_VERSION,
      },
      dataAsOf: DATA_AS_OF,
      locale: 'zh-CN',
    }

    const validated = dashboardSchemaV1.safeParse(candidate)
    if (!validated.success) {
      return failure({
        code: 'SCHEMA_INVALID',
        stage: 'schema_validation',
        message: '解析结果未通过 DashboardSchema v1 校验。',
        suggestion: '请使用内置示例格式重新描述需求。',
        fieldPath: validated.error.issues[0]?.path.join('.') ?? 'schema',
        cause: validated.error,
      })
    }
    return success(validated.data)
  }
}

export const intentParser = new IntentParser()
