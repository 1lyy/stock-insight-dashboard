import type { FormEvent, KeyboardEvent } from 'react'

interface QueryInputProps {
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (value: string) => void
  readonly onSubmit: () => void
}

export function QueryInput({ value, disabled, onChange, onSubmit }: QueryInputProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!disabled) onSubmit()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      if (!disabled) onSubmit()
    }
  }

  return (
    <form className="query-form" onSubmit={submit}>
      <label htmlFor="analysis-query">输入一句股票分析需求</label>
      <div className="query-composer">
        <textarea
          id="analysis-query"
          value={value}
          maxLength={200}
          rows={3}
          disabled={disabled}
          placeholder="例如：分析 A 公司最近 30 天的股价和成交量……"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="primary-button" type="submit" disabled={disabled || value.trim().length === 0}>
          {disabled ? '分析中…' : '生成看板'}
        </button>
      </div>
      <div className="query-meta">
        <span>Ctrl / ⌘ + Enter 提交</span>
        <span>{value.length}/200</span>
      </div>
    </form>
  )
}
