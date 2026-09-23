import { EXAMPLE_QUERIES } from '../../domain/schema/examples'

interface ExampleQueriesProps {
  readonly disabled: boolean
  readonly onSelect: (query: string) => void
}

export function ExampleQueries({ disabled, onSelect }: ExampleQueriesProps) {
  return (
    <section className="examples" aria-labelledby="examples-title">
      <div className="section-heading compact-heading">
        <div>
          <span className="section-kicker">QUICK START</span>
          <h2 id="examples-title">示例指令</h2>
        </div>
        <span className="section-note">点击即可运行</span>
      </div>
      <div className="example-grid">
        {EXAMPLE_QUERIES.map((example, index) => (
          <button
            className="example-card"
            type="button"
            key={example.id}
            disabled={disabled}
            onClick={() => onSelect(example.query)}
          >
            <span className="example-number">0{index + 1}</span>
            <span>{example.query}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
