export const ERROR_CODES = [
  'EMPTY_QUERY',
  'QUERY_TOO_LONG',
  'UNKNOWN_STOCK',
  'UNKNOWN_METRIC',
  'MISSING_REQUIREMENT',
  'AMBIGUOUS_QUERY',
  'INVALID_RANGE',
  'INVALID_DATE_RANGE',
  'RANGE_OUT_OF_DATASET',
  'NO_DATA',
  'INSUFFICIENT_DATA',
  'SCHEMA_INVALID',
  'CHART_CONFIG_INVALID',
  'FOLLOW_UP_WITHOUT_CONTEXT',
  'FOLLOW_UP_LIMIT_REACHED',
  'AMBIGUOUS_FOLLOW_UP',
  'UNSUPPORTED_FOLLOW_UP',
  'REQUEST_SUPERSEDED',
  'RENDER_FAILED',
  'DATA_SOURCE_UNAVAILABLE',
  'UNEXPECTED_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type ErrorStage =
  | 'input'
  | 'understanding'
  | 'schema_validation'
  | 'querying_data'
  | 'analysis'
  | 'rendering'

export interface AppError {
  readonly code: ErrorCode
  readonly stage: ErrorStage
  readonly message: string
  readonly suggestion: string
  readonly fieldPath?: string
  readonly cause?: unknown
}
