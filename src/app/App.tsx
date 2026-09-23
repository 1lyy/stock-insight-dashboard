import { useState } from 'react'
import { Dashboard } from '../components/Dashboard/Dashboard'
import { ErrorPanel } from '../components/ErrorPanel/ErrorPanel'
import { ExampleQueries } from '../components/ExampleQueries/ExampleQueries'
import { FollowUpInput } from '../components/FollowUpInput/FollowUpInput'
import { InsightPanel } from '../components/InsightPanel/InsightPanel'
import { ProcessSteps } from '../components/ProcessSteps/ProcessSteps'
import { QueryInput } from '../components/QueryInput/QueryInput'
import { SchemaViewer } from '../components/SchemaViewer/SchemaViewer'
import { DATA_AS_OF, DATASET_VERSION } from '../domain/datePolicy'
import { EXAMPLE_QUERIES } from '../domain/schema/examples'
import { useDashboardWorkflow } from './useDashboardWorkflow'

export function App({ stageDelayMs = 180 }: { readonly stageDelayMs?: number }) {
  const [query, setQuery] = useState<string>(EXAMPLE_QUERIES[0]?.query ?? '')
  const [followUp, setFollowUp] = useState('')
  const { state, run, runFollowUp, clearError, isRunning } = useDashboardWorkflow(stageDelayMs)

  const submit = () => {
    void run(query)
  }

  const runExample = (exampleQuery: string) => {
    setQuery(exampleQuery)
    void run(exampleQuery)
  }

  const submitFollowUp = () => {
    void runFollowUp(followUp)
  }

  const runFollowUpExample = (exampleQuery: string) => {
    setFollowUp(exampleQuery)
    void runFollowUp(exampleQuery)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="股票分析看板首页">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>SignalBoard</span>
        </a>
        <div className="dataset-badge">
          <span className="status-dot" aria-hidden="true" />
          Mock Data v{DATASET_VERSION}
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="hero-kicker">NATURAL LANGUAGE · STOCK ANALYTICS</p>
            <h1>一句话，生成你的<br /><span>股票分析看板</span></h1>
            <p className="hero-description">
              输入分析目标，系统将需求转换为可验证 Schema，基于固定模拟数据生成趋势图、极值标注和一致的数据结论。
            </p>
          </div>
          <aside className="hero-facts" aria-label="项目特性">
            <div><strong>100%</strong><span>离线可复现</span></div>
            <div><strong>Schema v1</strong><span>结构化输出</span></div>
            <div><strong>3</strong><span>模拟股票</span></div>
          </aside>
        </section>

        <section className="workspace-card" aria-label="分析输入">
          <QueryInput
            value={query}
            disabled={isRunning}
            onChange={setQuery}
            onSubmit={submit}
          />
          <ProcessSteps state={state} />
        </section>

        <ExampleQueries disabled={isRunning} onSelect={runExample} />

        <FollowUpInput
          value={followUp}
          disabled={isRunning}
          hasContext={Boolean(state.output)}
          used={state.followUpUsed}
          onChange={setFollowUp}
          onSubmit={submitFollowUp}
          onExample={runFollowUpExample}
        />

        {state.error && <ErrorPanel error={state.error} onDismiss={clearError} />}

        {state.output && (
          <div className={state.status === 'running' ? 'result-area result-updating' : 'result-area'}>
            <InsightPanel insight={state.output.insight} />
            <Dashboard output={state.output} />
            <SchemaViewer schema={state.output.schema} />
          </div>
        )}
      </main>

      <footer>
        <div>
          <strong>SignalBoard Demo</strong>
          <span>数据截止：{DATA_AS_OF}</span>
        </div>
        <p>所有数据均为固定模拟数据 · 不构成投资建议</p>
      </footer>
    </div>
  )
}
