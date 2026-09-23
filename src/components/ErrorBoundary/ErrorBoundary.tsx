import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  readonly children: ReactNode
}

interface ErrorBoundaryState {
  readonly error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dashboard render failed', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-shell" role="alert">
          <div className="fatal-card">
            <span className="fatal-mark" aria-hidden="true">!</span>
            <p className="section-kicker">RENDER_FAILED</p>
            <h1>页面遇到了意外问题</h1>
            <p>分析数据仍然安全。你可以尝试恢复页面，或刷新后从示例重新开始。</p>
            <button className="primary-button" type="button" onClick={this.reset}>尝试恢复</button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
