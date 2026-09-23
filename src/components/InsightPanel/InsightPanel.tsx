import type { Insight } from '../../services/insightGenerator'

export function InsightPanel({ insight }: { readonly insight: Insight }) {
  return (
    <section className="insight-panel" aria-labelledby="insight-title">
      <div className="insight-symbol" aria-hidden="true">↗</div>
      <div>
        <span className="section-kicker">DATA INSIGHT</span>
        <h2 id="insight-title">数据结论</h2>
        <p className="insight-text">{insight.text}</p>
        <p className="disclaimer">{insight.disclaimer}</p>
      </div>
    </section>
  )
}
