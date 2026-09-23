export const SCHEMA_VERSION = '1.0' as const
export const DATASET_VERSION = '1.0.0' as const
export const MARKET_TIMEZONE = 'Asia/Shanghai' as const
export const DATA_START_DATE = '2025-01-02' as const
export const DATA_END_DATE = '2025-03-31' as const
export const DATA_AS_OF = '2025-03-31T15:00:00+08:00' as const
export const MIN_TRADING_DAYS = 2
export const MAX_TRADING_DAYS = 60
export const MIN_ANNOTATION_COUNT = 1
export const MAX_ANNOTATION_COUNT = 10

/**
 * v1 date convention:
 * - Dates are ISO calendar dates (YYYY-MM-DD) interpreted in Asia/Shanghai.
 * - "Last N days" means the last N records with market data, including the end date.
 * - The built-in mock calendar contains Monday-Friday records; no holiday inference occurs at runtime.
 * - Explicit ranges are closed intervals. Missing/non-trading dates are not synthesized.
 */
export const DATE_CONVENTION = {
  timezone: MARKET_TIMEZONE,
  recentRange: 'last-n-available-trading-days-inclusive',
  explicitRange: 'closed-interval-existing-records-only',
  mockCalendar: 'weekdays-only-no-holiday-inference',
} as const
