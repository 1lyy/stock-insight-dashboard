import type { AppError } from '../../domain/errors'

interface ErrorPanelProps {
  readonly error: AppError
  readonly onDismiss: () => void
}

export function ErrorPanel({ error, onDismiss }: ErrorPanelProps) {
  return (
    <section className="error-panel" role="alert">
      <div className="error-icon" aria-hidden="true">!</div>
      <div className="error-copy">
        <div className="error-heading">
          <h2>无法生成本次看板</h2>
          <code>{error.code}</code>
        </div>
        <p>{error.message}</p>
        <p className="error-suggestion">建议：{error.suggestion}</p>
        {error.fieldPath && <small>相关字段：{error.fieldPath}</small>}
      </div>
      <button type="button" className="secondary-button" onClick={onDismiss}>关闭提示</button>
    </section>
  )
}
