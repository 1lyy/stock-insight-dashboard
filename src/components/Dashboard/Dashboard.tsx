import type { AnalysisOutput } from '../../services/analyzeQuery'
import { DashboardChart } from './DashboardChart'

export function Dashboard({ output }: { readonly output: AnalysisOutput }) {
  const { schema, queryResult } = output
  return (
    <section className="dashboard-section" aria-labelledby="dashboard-title">
      <div className="section-heading dashboard-heading">
        <div>
          <span className="section-kicker">ANALYSIS BOARD</span>
          <h2 id="dashboard-title">{schema.stock.name} 分析看板</h2>
        </div>
        <div className="dashboard-meta" aria-label="数据范围和来源">
          <span>{queryResult.actualRange.start} — {queryResult.actualRange.end}</span>
          <span>{queryResult.actualRange.tradingDays} 个交易日</span>
          <span data-testid="actual-data-source">
            实际来源：{queryResult.source.name}
            {queryResult.source.datasetVersion ? ` · v${queryResult.source.datasetVersion}` : ''}
          </span>
        </div>
      </div>
      {queryResult.notices.map((notice) => (
        <p className="data-notice" key={`${notice.code}-${notice.message}`}>{notice.message}</p>
      ))}
      {output.extrema.flatMap((analysis) => analysis.notice ? [analysis.notice] : []).map((notice) => (
        <p className="data-notice" key={notice}>{notice}</p>
      ))}
      <div className="chart-grid">
        {schema.charts.map((chart) => (
          <DashboardChart chart={chart} output={output} key={chart.id} />
        ))}
      </div>
    </section>
  )
}
