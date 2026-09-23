import type { DashboardSchemaV1 } from '../../domain/schema/dashboardSchema'

export function SchemaViewer({ schema }: { readonly schema: DashboardSchemaV1 }) {
  return (
    <details className="schema-viewer">
      <summary>
        <span>
          <span className="section-kicker">SCHEMA v{schema.version}</span>
          <strong>查看结构化解析结果</strong>
        </span>
        <span className="schema-summary">{schema.stock.symbol} · {schema.metrics.length} 个指标</span>
      </summary>
      <pre aria-label="Dashboard Schema JSON"><code>{JSON.stringify(schema, null, 2)}</code></pre>
    </details>
  )
}
