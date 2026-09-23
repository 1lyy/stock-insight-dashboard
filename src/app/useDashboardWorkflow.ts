import { useCallback, useRef, useState } from 'react'
import type { AppError, ErrorStage } from '../domain/errors'
import { analyzeQuery, type AnalysisOutput, type AnalysisStage } from '../services/analyzeQuery'

export type WorkflowStatus = 'idle' | 'running' | 'success' | 'error'

export interface WorkflowState {
  readonly status: WorkflowStatus
  readonly followUpUsed: boolean
  readonly activeStage?: AnalysisStage
  readonly failedStage?: AnalysisStage
  readonly output?: AnalysisOutput
  readonly error?: AppError
}

const initialState: WorkflowState = { status: 'idle', followUpUsed: false }

function errorStageToAnalysisStage(stage: ErrorStage): AnalysisStage {
  if (stage === 'querying_data') return 'querying_data'
  if (stage === 'analysis' || stage === 'rendering') return 'rendering'
  if (stage === 'schema_validation') return 'schema_ready'
  return 'understanding'
}

export function useDashboardWorkflow(stageDelayMs = 180) {
  const [state, setState] = useState<WorkflowState>(initialState)
  const requestSequence = useRef(0)

  const run = useCallback(async (query: string) => {
    const requestId = ++requestSequence.current
    setState((current) => ({
      status: 'running',
      followUpUsed: current.followUpUsed,
      activeStage: 'understanding',
      ...(current.output ? { output: current.output } : {}),
    }))

    const result = await analyzeQuery.executeWithProgress(query, {
      delayMs: stageDelayMs,
      onStage: (activeStage) => {
        if (requestSequence.current !== requestId) return
        setState((current) => ({
          status: 'running',
          followUpUsed: current.followUpUsed,
          activeStage,
          ...(current.output ? { output: current.output } : {}),
        }))
      },
    })

    if (requestSequence.current !== requestId) return
    if (result.ok) {
      setState({ status: 'success', followUpUsed: false, output: result.value })
      return
    }

    setState((current) => ({
      status: 'error',
      followUpUsed: current.followUpUsed,
      failedStage: errorStageToAnalysisStage(result.error.stage),
      error: result.error,
      ...(current.output ? { output: current.output } : {}),
    }))
  }, [stageDelayMs])

  const runFollowUp = useCallback(async (query: string) => {
    const requestId = ++requestSequence.current
    const previousOutput = state.output
    const alreadyUsed = state.followUpUsed
    setState({
      status: 'running',
      followUpUsed: alreadyUsed,
      activeStage: 'understanding',
      ...(previousOutput ? { output: previousOutput } : {}),
    })

    const result = await analyzeQuery.executeFollowUpWithProgress(query, previousOutput?.schema, {
      delayMs: stageDelayMs,
      alreadyUsed,
      onStage: (activeStage) => {
        if (requestSequence.current !== requestId) return
        setState({
          status: 'running',
          followUpUsed: alreadyUsed,
          activeStage,
          ...(previousOutput ? { output: previousOutput } : {}),
        })
      },
    })

    if (requestSequence.current !== requestId) return
    if (result.ok) {
      setState({ status: 'success', followUpUsed: true, output: result.value })
      return
    }

    setState({
      status: 'error',
      followUpUsed: alreadyUsed,
      failedStage: errorStageToAnalysisStage(result.error.stage),
      error: result.error,
      ...(previousOutput ? { output: previousOutput } : {}),
    })
  }, [stageDelayMs, state.followUpUsed, state.output])

  const clearError = useCallback(() => {
    setState((current) => current.output
      ? { status: 'success', followUpUsed: current.followUpUsed, output: current.output }
      : initialState)
  }, [])

  return {
    state,
    run,
    runFollowUp,
    clearError,
    isRunning: state.status === 'running',
  }
}
