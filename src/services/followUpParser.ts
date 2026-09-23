import {
  DATA_END_DATE,
  MARKET_TIMEZONE,
  MAX_TRADING_DAYS,
  MIN_TRADING_DAYS,
} from '../domain/datePolicy'
import type { AppError } from '../domain/errors'
import { METRIC_DEFINITIONS } from '../domain/metrics'
import { failure, success, type OperationResult } from '../domain/result'
import { dashboardSchemaV1, type DashboardSchemaV1 } from '../domain/schema/dashboardSchema'
import { LocalMockDataProvider } from '../infrastructure/LocalMockDataProvider'
import {
  createChartId,
  createChartTitle,
  createMetricSpec,
  createStableRequestId,
  normalizeInstruction,
} from './schemaPresentation'

type SupportedReplacementMetric = 'volume' | 'changePct'

interface FollowUpOptions {
  readonly alreadyUsed?: boolean
}

function followUpError(
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

function followUpRequestId(previousId: string, query: string): string {
  return createStableRequestId(`${previousId}:${query}`)
}

function metricFromText(text: string): SupportedReplacementMetric {
  return text === '成交量' || text === '交易量' ? 'volume' : 'changePct'
}

function validateCandidate(candidate: unknown): OperationResult<DashboardSchemaV1> {
  const result = dashboardSchemaV1.safeParse(candidate)
  if (result.success) return success(result.data)
  return failure({
    code: 'SCHEMA_INVALID',
    stage: 'schema_validation',
    message: '追问修改后的 Schema 未通过校验。',
    suggestion: '请重新生成基础看板后，再进行一次简单修改。',
    fieldPath: result.error.issues[0]?.path.join('.') ?? 'schema',
    cause: result.error,
  })
}

export class FollowUpParser {
  constructor(private readonly provider = new LocalMockDataProvider()) {}

  parse(
    input: string,
    previousSchema: DashboardSchemaV1 | undefined,
    options: FollowUpOptions = {},
  ): OperationResult<DashboardSchemaV1> {
    const query = normalizeInstruction(input)
    if (!previousSchema) {
      return followUpError(
        'FOLLOW_UP_WITHOUT_CONTEXT',
        '当前没有可修改的成功看板。',
        '请先运行一条完整分析指令，再提交追问。',
      )
    }
    if (options.alreadyUsed) {
      return followUpError(
        'FOLLOW_UP_LIMIT_REACHED',
        '当前看板已经完成过一次追问修改。',
        '请重新运行一条完整分析指令以开始新的分析。',
      )
    }
    if (!query) {
      return followUpError('EMPTY_QUERY', '请输入追问内容。', '例如：把成交量改成涨跌幅。')
    }
    if (query.length > 200) {
      return followUpError('QUERY_TOO_LONG', '追问不能超过 200 个字符。', '请精简修改要求。')
    }

    const metricMatches = [...query.matchAll(/把\s*(成交量|交易量|涨跌幅)\s*(?:改成|改为|换成)\s*(成交量|交易量|涨跌幅)/g)]
    const rangeMatches = [...query.matchAll(/(?:改为|改成|换成)\s*最近\s*(\d+)\s*(?:个)?(?:交易日|天)/g)]
    if (metricMatches.length + rangeMatches.length > 1) {
      return followUpError(
        'AMBIGUOUS_FOLLOW_UP',
        '一次追问中检测到多个修改要求。',
        '请只修改一个指标，或只修改时间范围。',
      )
    }

    const metricMatch = metricMatches[0]
    if (metricMatch) {
      const fromText = metricMatch[1]
      const toText = metricMatch[2]
      if (!fromText || !toText) {
        return followUpError('UNSUPPORTED_FOLLOW_UP', '无法识别指标替换。', '例如：把成交量改成涨跌幅。')
      }
      const fromMetric = metricFromText(fromText)
      const toMetric = metricFromText(toText)
      if (fromMetric === toMetric) {
        return followUpError('UNSUPPORTED_FOLLOW_UP', '替换前后的指标相同，没有可应用的修改。', '请指定不同的目标指标。')
      }
      return this.replaceMetric(previousSchema, query, fromMetric, toMetric)
    }

    const rangeMatch = rangeMatches[0]
    if (rangeMatch) {
      const tradingDays = Number(rangeMatch[1])
      if (!Number.isInteger(tradingDays) || tradingDays < MIN_TRADING_DAYS || tradingDays > MAX_TRADING_DAYS) {
        return followUpError(
          'INVALID_RANGE',
          `最近交易日数量必须在 ${MIN_TRADING_DAYS} 到 ${MAX_TRADING_DAYS} 之间。`,
          '请修改“最近 N 天”中的 N。',
          'timeRange.tradingDays',
        )
      }
      return this.replaceTimeRange(previousSchema, query, tradingDays)
    }

    return followUpError(
      'UNSUPPORTED_FOLLOW_UP',
      '当前只支持修改成交量/涨跌幅，或改为最近 N 个交易日。',
      '例如：“把成交量改成涨跌幅”或“改为最近 10 天”。',
    )
  }

  private replaceMetric(
    schema: DashboardSchemaV1,
    query: string,
    fromMetric: SupportedReplacementMetric,
    toMetric: SupportedReplacementMetric,
  ): OperationResult<DashboardSchemaV1> {
    const sourceChartExists = schema.charts.some((chart) => chart.metricIds.includes(fromMetric))
    if (!sourceChartExists) {
      return followUpError(
        'UNSUPPORTED_FOLLOW_UP',
        `当前看板没有可替换的“${METRIC_DEFINITIONS[fromMetric].label}”图表。`,
        '请修改当前看板已有的指标，或重新提交完整分析指令。',
      )
    }
    if (schema.charts.some((chart) => chart.metricIds.includes(toMetric))) {
      return followUpError(
        'UNSUPPORTED_FOLLOW_UP',
        `当前看板已经包含“${METRIC_DEFINITIONS[toMetric].label}”图表。`,
        '请保留当前看板，或重新提交完整分析指令。',
      )
    }

    const metricIds = schema.metrics.map((metric) => metric.id === fromMetric ? toMetric : metric.id)
    const uniqueMetricIds = [...new Set(metricIds)]
    const charts = schema.charts.map((chart) => {
      if (!chart.metricIds.includes(fromMetric)) {
        return {
          ...chart,
          annotations: chart.annotations.map((annotation) => annotation.metricId === fromMetric
            ? { ...annotation, metricId: toMetric }
            : annotation),
        }
      }

      const type = METRIC_DEFINITIONS[toMetric].defaultChartType
      return {
        ...chart,
        id: createChartId(toMetric, type),
        type,
        title: createChartTitle(schema.stock.name, schema.timeRange, toMetric),
        metricIds: chart.metricIds.map((metricId) => metricId === fromMetric ? toMetric : metricId),
        yFields: chart.yFields.map((metricId) => metricId === fromMetric ? toMetric : metricId),
        annotations: chart.annotations.map((annotation) => annotation.metricId === fromMetric
          ? { ...annotation, metricId: toMetric }
          : annotation),
      }
    })

    return validateCandidate({
      ...schema,
      requestId: followUpRequestId(schema.requestId, query),
      metrics: uniqueMetricIds.map(createMetricSpec),
      charts,
    })
  }

  private replaceTimeRange(
    schema: DashboardSchemaV1,
    query: string,
    tradingDays: number,
  ): OperationResult<DashboardSchemaV1> {
    const dates = this.provider.getAvailableDates(schema.stock.symbol).filter((date) => date <= DATA_END_DATE)
    const start = dates.at(-tradingDays)
    const end = dates.at(-1)
    if (!start || !end) {
      return followUpError('RANGE_OUT_OF_DATASET', '模拟数据不足以覆盖追问中的时间范围。', '请缩短交易日数量。')
    }

    const timeRange: DashboardSchemaV1['timeRange'] = {
      mode: 'lastTradingDays',
      start,
      end,
      tradingDays,
      timezone: MARKET_TIMEZONE,
    }
    const charts = schema.charts.map((chart) => {
      const primaryMetric = chart.yFields[0]
      return {
        ...chart,
        ...(primaryMetric ? { title: createChartTitle(schema.stock.name, timeRange, primaryMetric) } : {}),
      }
    })

    return validateCandidate({
      ...schema,
      requestId: followUpRequestId(schema.requestId, query),
      timeRange,
      charts,
    })
  }
}

export const followUpParser = new FollowUpParser()
