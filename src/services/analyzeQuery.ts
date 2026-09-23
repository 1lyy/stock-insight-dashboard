import type { AppError, ErrorStage } from '../domain/errors'
import { failure, type OperationResult } from '../domain/result'
import type { DashboardSchemaV1 } from '../domain/schema/dashboardSchema'
import type { StockSeries } from '../infrastructure/DataProvider'
import type { DataProvider } from '../infrastructure/DataProvider'
import { FallbackDataProvider } from '../infrastructure/FallbackDataProvider'
import { LocalMockDataProvider } from '../infrastructure/LocalMockDataProvider'
import { WenCaiSkillDataProvider } from '../infrastructure/WenCaiSkillDataProvider'
import { InsightGenerator, type Insight } from './insightGenerator'
import { FollowUpParser } from './followUpParser'
import { IntentParser } from './intentParser'
import { MetricEngine, type EnrichedPriceBar, type ExtremumAnalysis } from './metricEngine'

export interface AnalysisOutput {
  readonly schema: DashboardSchemaV1
  readonly queryResult: StockSeries
  readonly series: readonly EnrichedPriceBar[]
  readonly extrema: readonly ExtremumAnalysis[]
  readonly insight: Insight
}

export type AnalysisStage = 'understanding' | 'schema_ready' | 'querying_data' | 'rendering'

export interface ProgressOptions {
  readonly requestId?: string
  readonly delayMs?: number
  readonly onStage?: (stage: AnalysisStage) => void
  readonly alreadyUsed?: boolean
}

export class AnalyzeQuery {
  private readonly parser: IntentParser
  private readonly followUps: FollowUpParser
  private readonly metrics = new MetricEngine()
  private readonly insights = new InsightGenerator()

  constructor(
    private readonly provider: DataProvider = new LocalMockDataProvider(),
    calendarProvider = new LocalMockDataProvider(),
  ) {
    this.parser = new IntentParser(calendarProvider)
    this.followUps = new FollowUpParser(calendarProvider)
  }

  execute(input: string, requestId?: string): OperationResult<AnalysisOutput> {
    try {
      const schemaResult = this.parser.parse(input, requestId ? { requestId } : {})
      if (!schemaResult.ok) return schemaResult
      return this.executeSchema(schemaResult.value)
    } catch (error) {
      return failure(this.unexpectedError(error, 'analysis'))
    }
  }

  executeFollowUp(
    input: string,
    previousSchema?: DashboardSchemaV1,
    alreadyUsed = false,
  ): OperationResult<AnalysisOutput> {
    try {
      const schemaResult = this.followUps.parse(input, previousSchema, { alreadyUsed })
      if (!schemaResult.ok) return schemaResult
      return this.executeSchema(schemaResult.value)
    } catch (error) {
      return failure(this.unexpectedError(error, 'analysis'))
    }
  }

  async executeWithProgress(input: string, options: ProgressOptions = {}): Promise<OperationResult<AnalysisOutput>> {
    return this.executeWithProgressInternal(
      () => this.parser.parse(input, options.requestId ? { requestId: options.requestId } : {}),
      options,
    )
  }

  async executeFollowUpWithProgress(
    input: string,
    previousSchema: DashboardSchemaV1 | undefined,
    options: ProgressOptions = {},
  ): Promise<OperationResult<AnalysisOutput>> {
    return this.executeWithProgressInternal(
      () => this.followUps.parse(input, previousSchema, { alreadyUsed: options.alreadyUsed ?? false }),
      options,
    )
  }

  private async executeWithProgressInternal(
    parseSchema: () => OperationResult<DashboardSchemaV1>,
    options: ProgressOptions,
  ): Promise<OperationResult<AnalysisOutput>> {
    let currentStage: AnalysisStage = 'understanding'
    const report = async (stage: AnalysisStage) => {
      currentStage = stage
      options.onStage?.(stage)
      if ((options.delayMs ?? 0) > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs))
      }
    }

    try {
      await report('understanding')
      const schemaResult = parseSchema()
      if (!schemaResult.ok) return schemaResult

      await report('schema_ready')
      await report('querying_data')
      const queryResult = this.provider.query({
        symbol: schemaResult.value.stock.symbol,
        timeRange: schemaResult.value.timeRange,
      })
      if (!queryResult.ok) return queryResult

      const output = this.buildOutput(schemaResult.value, queryResult.value)
      if (!output.ok) return output
      await report('rendering')
      return output
    } catch (error) {
      return failure(this.unexpectedError(error, this.errorStageFor(currentStage)))
    }
  }

  private executeSchema(schema: DashboardSchemaV1): OperationResult<AnalysisOutput> {
    const queryResult = this.provider.query({
      symbol: schema.stock.symbol,
      timeRange: schema.timeRange,
    })
    if (!queryResult.ok) return queryResult
    return this.buildOutput(schema, queryResult.value)
  }

  private buildOutput(
    schema: DashboardSchemaV1,
    queryResult: StockSeries,
  ): OperationResult<AnalysisOutput> {
    const series = this.metrics.derive(queryResult)
    const extremaResult = this.metrics.analyzeAnnotations(schema, series)
    if (!extremaResult.ok) return extremaResult

    return {
      ok: true,
      value: {
        schema,
        queryResult,
        series,
        extrema: extremaResult.value,
        insight: this.insights.generate(schema, queryResult, series, extremaResult.value),
      },
    }
  }

  private errorStageFor(stage: AnalysisStage): ErrorStage {
    if (stage === 'schema_ready') return 'schema_validation'
    if (stage === 'querying_data') return 'querying_data'
    if (stage === 'rendering') return 'rendering'
    return 'understanding'
  }

  private unexpectedError(cause: unknown, stage: ErrorStage): AppError {
    return {
      code: 'UNEXPECTED_ERROR',
      stage,
      message: '处理过程中发生了意外错误，但页面和上一次成功结果仍可继续使用。',
      suggestion: '请重试，或选择一条内置示例重新开始。',
      cause,
    }
  }
}

const localMockDataProvider = new LocalMockDataProvider()

export const analyzeQuery = new AnalyzeQuery(
  new FallbackDataProvider(new WenCaiSkillDataProvider(), localMockDataProvider),
  localMockDataProvider,
)
