import type { AnalysisStage } from '../../services/analyzeQuery'
import type { WorkflowState } from '../../app/useDashboardWorkflow'

const STEPS: ReadonlyArray<{ key: AnalysisStage; label: string; description: string }> = [
  { key: 'understanding', label: '理解需求', description: '识别股票、指标和范围' },
  { key: 'schema_ready', label: '生成 Schema', description: '规范化并校验结构' },
  { key: 'querying_data', label: '查询数据', description: '读取固定 Mock 行情' },
  { key: 'rendering', label: '渲染图表', description: '组织序列与分析结论' },
]

type StepStatus = 'pending' | 'active' | 'complete' | 'error'

function getStepStatus(step: AnalysisStage, state: WorkflowState): StepStatus {
  const stepIndex = STEPS.findIndex((candidate) => candidate.key === step)
  if (state.status === 'success') return 'complete'
  if (state.status === 'idle') return 'pending'
  if (state.status === 'error') {
    const failedIndex = STEPS.findIndex((candidate) => candidate.key === state.failedStage)
    if (stepIndex < failedIndex) return 'complete'
    return stepIndex === failedIndex ? 'error' : 'pending'
  }
  const activeIndex = STEPS.findIndex((candidate) => candidate.key === state.activeStage)
  if (stepIndex < activeIndex) return 'complete'
  return stepIndex === activeIndex ? 'active' : 'pending'
}

export function ProcessSteps({ state }: { readonly state: WorkflowState }) {
  return (
    <section className="process-panel" aria-label="分析流程" aria-live="polite">
      <ol className="process-list">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.key, state)
          return (
            <li className={`process-step process-${status}`} key={step.key}>
              <span className="step-marker" aria-hidden="true">
                {status === 'complete' ? '✓' : status === 'error' ? '!' : index + 1}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.description}</small>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
