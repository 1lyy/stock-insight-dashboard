import type { FormEvent } from 'react'

const FOLLOW_UP_EXAMPLES = ['把成交量改成涨跌幅', '改为最近 10 天'] as const

interface FollowUpInputProps {
  readonly value: string
  readonly disabled: boolean
  readonly hasContext: boolean
  readonly used: boolean
  readonly onChange: (value: string) => void
  readonly onSubmit: () => void
  readonly onExample: (value: string) => void
}

export function FollowUpInput({
  value,
  disabled,
  hasContext,
  used,
  onChange,
  onSubmit,
  onExample,
}: FollowUpInputProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!disabled && !used) onSubmit()
  }

  return (
    <section className="follow-up-card" aria-labelledby="follow-up-title">
      <div className="follow-up-heading">
        <div>
          <span className="section-kicker">ONE-TURN FOLLOW-UP</span>
          <h2 id="follow-up-title">修改当前看板</h2>
        </div>
        <span className={`context-badge ${hasContext ? 'context-ready' : ''}`}>
          {used ? '本轮已使用' : hasContext ? '已连接上次结果' : '等待基础看板'}
        </span>
      </div>
      <p className="follow-up-description">
        支持一次简单修改。修改后仍会重新校验 Schema、查询数据并生成结论。
      </p>
      <div className="follow-up-examples" aria-label="追问示例">
        {FOLLOW_UP_EXAMPLES.map((example) => (
          <button
            type="button"
            key={example}
            disabled={disabled || used}
            onClick={() => onExample(example)}
          >
            {example}
          </button>
        ))}
      </div>
      <form className="follow-up-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="follow-up-query">输入追问修改</label>
        <input
          id="follow-up-query"
          value={value}
          maxLength={200}
          disabled={disabled || used}
          placeholder="例如：把成交量改成涨跌幅"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="secondary-button"
          type="submit"
          disabled={disabled || used || value.trim().length === 0}
        >
          {used ? '已完成一次修改' : disabled ? '处理中…' : '应用修改'}
        </button>
      </form>
      {!hasContext && !used && <small>没有上下文时提交会返回明确提示；请先生成一个基础看板。</small>}
      {used && <small>如需继续分析，请重新运行一条完整指令以创建新的上下文。</small>}
    </section>
  )
}
