// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import { EXAMPLE_QUERIES } from '../../src/domain/schema/examples'

vi.mock('echarts-for-react/lib/core', () => ({
  default: ({ option }: { option: { series?: unknown[] } }) => (
    <div data-testid="echarts" data-series-count={option.series?.length ?? 0}>ECharts</div>
  ),
}))

afterEach(cleanup)

describe('Dashboard main flow', () => {
  it('renders the input and all five runnable example commands', () => {
    render(<App stageDelayMs={0} />)

    expect(screen.getByLabelText('输入一句股票分析需求')).toBeTruthy()
    for (const example of EXAMPLE_QUERIES) {
      expect(screen.getByRole('button', { name: new RegExp(example.query.slice(0, 12)) })).toBeTruthy()
    }
  })

  it('runs the default query and renders charts, insight, process completion and Schema viewer', async () => {
    const user = userEvent.setup()
    render(<App stageDelayMs={0} />)

    await user.click(screen.getByRole('button', { name: '生成看板' }))

    expect(await screen.findByRole('heading', { name: 'A 公司 分析看板' })).toBeTruthy()
    expect(screen.getAllByTestId('echarts')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: '数据结论' })).toBeTruthy()
    expect(screen.getByText(/数据为模拟数据，仅用于演示/)).toBeTruthy()
    expect(screen.getByTestId('actual-data-source').textContent).toContain('Built-in Mock Market Data')
    expect(screen.getByText(/问财 Skill Hub 当前不可用，已自动回退/)).toBeTruthy()
    expect(screen.getByText('查看结构化解析结果')).toBeTruthy()
    await waitFor(() => {
      expect(document.querySelectorAll('.process-complete')).toHaveLength(4)
    })
  })

  it('runs an example immediately when its card is selected', async () => {
    const user = userEvent.setup()
    render(<App stageDelayMs={0} />)

    await user.click(screen.getByRole('button', { name: new RegExp(EXAMPLE_QUERIES[1]!.query.slice(0, 12)) }))

    expect(await screen.findByRole('heading', { name: 'B 公司 分析看板' })).toBeTruthy()
    expect((screen.getByLabelText('输入一句股票分析需求') as HTMLTextAreaElement).value).toBe(EXAMPLE_QUERIES[1]!.query)
  })

  it('shows an explainable domain error without removing the page', async () => {
    const user = userEvent.setup()
    render(<App stageDelayMs={0} />)
    const input = screen.getByLabelText('输入一句股票分析需求')

    await user.clear(input)
    await user.type(input, '分析 A 公司最近 10 天的市盈率')
    await user.click(screen.getByRole('button', { name: '生成看板' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('UNKNOWN_METRIC')
    expect(alert.textContent).toContain('暂不支持指标')
    expect(screen.getByRole('heading', { name: /一句话/ })).toBeTruthy()
  })

  it('shows a clear error when a follow-up is submitted without context', async () => {
    const user = userEvent.setup()
    render(<App stageDelayMs={0} />)

    await user.click(screen.getByRole('button', { name: '改为最近 10 天' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('FOLLOW_UP_WITHOUT_CONTEXT')
    expect(alert.textContent).toContain('请先运行一条完整分析指令')
  })

  it('applies one metric follow-up and rerenders the validated dashboard', async () => {
    const user = userEvent.setup()
    render(<App stageDelayMs={0} />)
    await user.click(screen.getByRole('button', { name: '生成看板' }))
    await screen.findByRole('heading', { name: 'A 公司 分析看板' })

    await user.click(screen.getByRole('button', { name: '把成交量改成涨跌幅' }))

    expect(await screen.findByLabelText('A 公司最近 30 个交易日涨跌幅')).toBeTruthy()
    expect(screen.queryByLabelText('A 公司最近 30 个交易日成交量')).toBeNull()
    expect(screen.getByRole('button', { name: '已完成一次修改' })).toBeTruthy()
  })

  it('applies a recent-10-days follow-up and rerenders the new query range', async () => {
    const user = userEvent.setup()
    render(<App stageDelayMs={0} />)
    await user.click(screen.getByRole('button', { name: '生成看板' }))
    await screen.findByRole('heading', { name: 'A 公司 分析看板' })

    await user.click(screen.getByRole('button', { name: '改为最近 10 天' }))

    expect(await screen.findByLabelText('A 公司最近 10 个交易日收盘价')).toBeTruthy()
    expect(screen.getByLabelText('A 公司最近 10 个交易日成交量')).toBeTruthy()
    expect(screen.getByText('2025-03-18 — 2025-03-31')).toBeTruthy()
  })

  it('rejects a conflicting follow-up and keeps the last successful dashboard', async () => {
    const user = userEvent.setup()
    render(<App stageDelayMs={0} />)
    await user.click(screen.getByRole('button', { name: '生成看板' }))
    await screen.findByRole('heading', { name: 'A 公司 分析看板' })

    const input = screen.getByLabelText('输入追问修改')
    await user.type(input, '把成交量改成涨跌幅，并改为最近 10 天')
    await user.click(screen.getByRole('button', { name: '应用修改' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('AMBIGUOUS_FOLLOW_UP')
    expect(screen.getByLabelText('A 公司最近 30 个交易日成交量')).toBeTruthy()
  })

  it('shows NO_DATA for a valid date range outside the fixture without crashing', async () => {
    const user = userEvent.setup()
    render(<App stageDelayMs={0} />)
    const input = screen.getByLabelText('输入一句股票分析需求')

    await user.clear(input)
    await user.type(input, '展示 A 公司 2026-01-01 到 2026-01-10 的收盘价。')
    await user.click(screen.getByRole('button', { name: '生成看板' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('NO_DATA')
    expect(screen.getByRole('heading', { name: /一句话/ })).toBeTruthy()
  })
})
