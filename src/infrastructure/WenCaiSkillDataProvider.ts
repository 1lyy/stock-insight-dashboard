import { failure } from '../domain/result'
import type { DataProvider, DataQuery } from './DataProvider'

/**
 * Verified discovery metadata only. This is intentionally not an HTTP client:
 * the current runtime has no connected Skill/MCP or credential with which to
 * verify a successful call and the application's MOCK-* symbols are not real
 * thscode identifiers.
 */
export const WENCAI_SKILL_DISCOVERY = Object.freeze({
  service: 'hithink-finance-a-share',
  historicalPriceTool: 'get_a_share_prices_historical',
  requiredParameters: ['thscode', 'interval', 'start', 'end'] as const,
  optionalParameters: ['adjust', 'offset'] as const,
  credentialEnvironmentVariable: 'HITHINK_FINANCE_API_KEY',
  status: 'unavailable-in-current-runtime' as const,
})

/**
 * Deliberately unavailable adapter boundary. It prevents an unverified API
 * implementation from being mistaken for a live Skill integration while still
 * allowing the fallback chain to be exercised through DataProvider.
 */
export class WenCaiSkillDataProvider implements DataProvider {
  query(query: DataQuery) {
    void query
    return failure({
      code: 'DATA_SOURCE_UNAVAILABLE',
      stage: 'querying_data',
      message: '当前运行环境未连接可验证的问财 Skill Hub 数据能力。',
      suggestion: '继续使用内置 Mock 数据；配置并验证官方 Skill、凭据和真实证券标识后再启用外部数据源。',
    })
  }
}
