import { describe, expect, it } from 'vitest'
import { MARKET_TIMEZONE } from '../../src/domain/datePolicy'
import { FallbackDataProvider } from '../../src/infrastructure/FallbackDataProvider'
import { LocalMockDataProvider } from '../../src/infrastructure/LocalMockDataProvider'
import {
  WENCAI_SKILL_DISCOVERY,
  WenCaiSkillDataProvider,
} from '../../src/infrastructure/WenCaiSkillDataProvider'

const query = {
  symbol: 'MOCK-A',
  timeRange: {
    mode: 'lastTradingDays',
    start: '2025-03-18',
    end: '2025-03-31',
    tradingDays: 10,
    timezone: MARKET_TIMEZONE,
  },
} as const

describe('WenCai adapter and fallback', () => {
  it('reports the adapter as unavailable instead of fabricating an external response', () => {
    const result = new WenCaiSkillDataProvider().query(query)

    expect(WENCAI_SKILL_DISCOVERY.historicalPriceTool).toBe('get_a_share_prices_historical')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DATA_SOURCE_UNAVAILABLE')
  })

  it('falls back to fixed mock data and records the actual source', () => {
    const provider = new FallbackDataProvider(
      new WenCaiSkillDataProvider(),
      new LocalMockDataProvider(),
    )

    const result = provider.query(query)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.source.type).toBe('mock')
      expect(result.value.bars).toHaveLength(10)
      expect(result.value.notices[0]?.code).toBe('EXTERNAL_SOURCE_FALLBACK')
    }
  })
})
