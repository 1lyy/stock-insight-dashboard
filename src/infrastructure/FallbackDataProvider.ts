import { failure, success } from '../domain/result'
import type { DataProvider, DataQuery, DataQueryResult } from './DataProvider'

function safeQuery(provider: DataProvider, query: DataQuery): DataQueryResult {
  try {
    return provider.query(query)
  } catch (cause) {
    return failure({
      code: 'DATA_SOURCE_UNAVAILABLE',
      stage: 'querying_data',
      message: '数据源调用发生未预期异常。',
      suggestion: '系统将尝试使用可用的回退数据源。',
      cause,
    })
  }
}

export class FallbackDataProvider implements DataProvider {
  constructor(
    private readonly primary: DataProvider,
    private readonly fallback: DataProvider,
    private readonly primaryName = '问财 Skill Hub',
  ) {}

  query(query: DataQuery): DataQueryResult {
    const primaryResult = safeQuery(this.primary, query)
    if (primaryResult.ok) return primaryResult

    const fallbackResult = safeQuery(this.fallback, query)
    if (!fallbackResult.ok) return fallbackResult

    return success({
      ...fallbackResult.value,
      notices: [
        {
          code: 'EXTERNAL_SOURCE_FALLBACK',
          message: `${this.primaryName} 当前不可用，已自动回退到 ${fallbackResult.value.source.name}。`,
        },
        ...fallbackResult.value.notices,
      ],
    })
  }
}
