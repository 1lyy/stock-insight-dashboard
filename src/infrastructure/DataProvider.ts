import type { PriceBar, Stock } from '../domain/entities'
import type { AppError } from '../domain/errors'
import type { DashboardSchemaV1 } from '../domain/schema/dashboardSchema'

export type StockSymbol = DashboardSchemaV1['stock']['symbol']
export type TimeRange = DashboardSchemaV1['timeRange']

export interface DataQuery {
  readonly symbol: StockSymbol
  readonly timeRange: TimeRange
}

export interface QueryNotice {
  readonly code: 'RANGE_CLIPPED' | 'EXTERNAL_SOURCE_FALLBACK'
  readonly message: string
}

export interface DataSourceAttribution {
  readonly type: 'mock' | 'wen-cai-skill-hub'
  readonly name: string
  readonly datasetVersion?: string
  readonly dataAsOf?: string
}

export interface StockSeries {
  readonly stock: Stock
  readonly bars: readonly PriceBar[]
  readonly previousBar?: PriceBar
  readonly source: DataSourceAttribution
  readonly actualRange: {
    readonly start: string
    readonly end: string
    readonly tradingDays: number
  }
  readonly notices: readonly QueryNotice[]
}

export type DataQueryResult =
  | { readonly ok: true; readonly value: StockSeries }
  | { readonly ok: false; readonly error: AppError }

export interface DataProvider {
  query(query: DataQuery): DataQueryResult
}
