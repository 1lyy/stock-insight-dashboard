# 一句话生成股票分析看板

一个完全离线、结果可复现的 React Demo：将中文股票分析指令解析为经过 Zod 校验的 `DashboardSchema v1`，使用固定模拟行情生成 ECharts 看板和数据一致的简短结论，并支持基于最近一次成功结果的一次简单追问修改。

> 所有股票和行情均为模拟数据，仅用于功能演示，不构成投资建议。

## 当前完成度

- 阶段 0：Schema 契约、指标白名单、错误码、静态数据和 fixture。
- 阶段 1：确定性 IntentParser、数据查询、涨跌幅/极值计算和 InsightGenerator。
- 阶段 2：输入、执行状态、Schema Viewer、折线图、柱状图、错误面板和 Error Boundary。
- 阶段 3：一次简单追问、交付文档及追问测试。

P2 已完成问财 Skill Hub 可用性探测和回退适配层；当前环境未连接可验证的 Skill/MCP，也没有凭据，因此不会请求或伪造真实行情，运行时明确回退到固定 Mock 数据。在线模型和后端服务仍未接入。

## 快速开始

环境要求：

- Node.js 20.19 或更高版本
- npm 11；实际依赖版本由 `package-lock.json` 锁定

```bash
npm install
npm run dev
```

Vite 默认输出本地访问地址。其他命令：

```bash
npm test          # 运行全部单元及 UI 集成测试
npm run lint      # ESLint 静态检查（零 warning）
npm run typecheck # TypeScript strict 检查
npm run build     # 类型检查并生成生产构建
npm run preview   # 预览生产构建
```

## 使用方式

1. 在主输入框输入完整分析需求，或点击任意示例指令。
2. 查看“理解需求 → 生成 Schema → 查询数据 → 渲染图表”的执行状态。
3. 查看结论、图表、数据来源及可展开的 Schema JSON。
4. 成功生成基础看板后，可提交一次追问：
   - `把成交量改成涨跌幅`
   - `改为最近 10 天`
5. 追问修改会重新执行 Schema 校验、数据查询、指标计算、结论生成和图表渲染。

追问失败不会清除最近一次成功看板。完成一次成功追问后，需要重新运行完整指令才能建立新的追问上下文。

## 5 条固定样例

| ID | 输入 | 预期股票/范围 | 预期输出 |
| --- | --- | --- | --- |
| `demo-001` | 分析 A 公司最近 30 天的股价和成交量，并标出跌幅最大的 3 个交易日。 | MOCK-A，最近 30 个交易日 | 收盘价折线图、成交量柱状图、最大跌幅 3 日标注 |
| `demo-002` | 查看 B 公司最近 10 个交易日的收盘价走势。 | MOCK-B，最近 10 个交易日 | 收盘价折线图 |
| `demo-003` | 用柱状图展示 A 公司最近 20 个交易日的成交量。 | MOCK-A，最近 20 个交易日 | 成交量柱状图 |
| `demo-004` | 比较 C 公司最近 15 个交易日的涨跌幅，并标出涨幅最大的 3 天。 | MOCK-C，最近 15 个交易日 | 涨跌幅柱状图、最大涨幅 3 日标注 |
| `demo-005` | 展示 B 公司 2025-03-03 到 2025-03-28 的收盘价和成交量。 | MOCK-B，明确日期闭区间 | 收盘价折线图、成交量柱状图 |

样例源定义位于 [`src/domain/schema/examples.ts`](./src/domain/schema/examples.ts)，完整预期 Schema fixture 位于 [`tests/fixtures/schemas`](./tests/fixtures/schemas)。测试保证自然语言解析结果与这些 fixture 逐字段一致。

## DashboardSchema v1

Schema 必须经过 `dashboardSchemaV1` 的运行时和业务交叉校验，才能进入数据查询和渲染流程。下面是 `demo-001` 的结构示例，完整 JSON 见 [`demo-001.json`](./tests/fixtures/schemas/demo-001.json)：

```json
{
  "version": "1.0",
  "requestId": "demo-001",
  "stock": {
    "symbol": "MOCK-A",
    "name": "A 公司"
  },
  "timeRange": {
    "mode": "lastTradingDays",
    "start": "2025-02-18",
    "end": "2025-03-31",
    "tradingDays": 30,
    "timezone": "Asia/Shanghai"
  },
  "metrics": [
    { "id": "close", "label": "收盘价", "unit": "元" },
    { "id": "volume", "label": "成交量", "unit": "股" },
    { "id": "changePct", "label": "涨跌幅", "unit": "%" }
  ],
  "charts": [
    {
      "id": "price-trend",
      "type": "line",
      "title": "A 公司最近 30 个交易日收盘价",
      "metricIds": ["close"],
      "xField": "date",
      "yFields": ["close"],
      "annotations": [
        { "kind": "bottomN", "metricId": "changePct", "count": 3 }
      ]
    },
    {
      "id": "volume-bars",
      "type": "bar",
      "title": "A 公司最近 30 个交易日成交量",
      "metricIds": ["volume"],
      "xField": "date",
      "yFields": ["volume"],
      "annotations": []
    }
  ],
  "dataSource": {
    "type": "mock",
    "name": "Built-in Mock Market Data",
    "datasetVersion": "1.0.0"
  },
  "dataAsOf": "2025-03-31T15:00:00+08:00",
  "locale": "zh-CN"
}
```

主要业务校验包括：股票代码与名称一致、指标 ID 唯一、指标标签和单位匹配白名单、图表 ID 唯一、图表及标注只能引用 Schema 中已有指标、日期真实有效且开始日期不晚于结束日期。

## 技术架构

```text
React UI
  └─ useDashboardWorkflow
       └─ AnalyzeQuery
            ├─ IntentParser / FollowUpParser
            ├─ DashboardSchema v1 + Zod
            ├─ DataProvider
            │    ├─ WenCaiSkillDataProvider（未连接适配边界）
            │    └─ FallbackDataProvider → LocalMockDataProvider
            ├─ MetricEngine
            └─ InsightGenerator
```

- UI 只消费 `AnalysisOutput`，不重新计算涨跌幅、极值或结论。
- `IntentParser` 将完整指令生成 Schema。
- `FollowUpParser` 在上一次成功 Schema 上生成受控补丁，并重新运行同一校验和分析链路。
- `LocalMockDataProvider` 只读取提交到仓库的 JSON。
- `WenCaiSkillDataProvider` 在没有经过成功调用验证时只返回 `DATA_SOURCE_UNAVAILABLE`，不包含猜测的 HTTP/MCP 实现。
- `FallbackDataProvider` 在外部 Provider 不可用或抛出异常时自动使用本地 Provider；看板读取查询结果中的 `source`，显示实际来源而不是假定来源。
- `MetricEngine` 是图表序列和极值结果的唯一计算来源。
- `InsightGenerator` 使用相同查询结果生成机器可验证的 `facts` 和用户文案。

## 数据口径

数据清单见 [`dataManifest.json`](./src/data/dataManifest.json)。

| 项目 | 固定口径 |
| --- | --- |
| 数据版本 | `1.0.0` |
| Schema 版本 | `1.0` |
| 股票 | A/B/C 三只虚构股票，对应 MOCK-A/B/C |
| 记录数量 | 每只 63 个交易日 |
| 日期范围 | `2025-01-02` 至 `2025-03-31` |
| 截止时间 | `2025-03-31T15:00:00+08:00` |
| 时区 | `Asia/Shanghai` |
| 模拟交易日 | 周一至周五；不在运行时推断真实节假日 |
| 价格单位 | 人民币元，展示保留 2 位小数 |
| 成交量单位 | 股，原始值为非负整数 |
| 涨跌幅单位 | `%`，`(当日收盘价 - 前一交易日收盘价) / 前一交易日收盘价 × 100` |

“最近 N 天”指截止日期向前 N 个有数据的交易日，包含截止日。为计算展示区间首日涨跌幅，Provider 会额外读取前一交易日作为计算上下文，但不会把该记录加入图表。

明确日期范围使用闭区间，只返回实际存在的记录；周末或缺失日期不会补值。范围完全没有数据时返回 `NO_DATA`。

Top N 先过滤无效值，再按指标数值排序；并列时按日期升序，保证输出稳定。图表、极值和结论共享同一份标准化结果。

静态行情位于 [`src/data/prices`](./src/data/prices)。[`generateMockData.mjs`](./scripts/generateMockData.mjs) 仅是维护者使用的确定性 fixture 再生成工具，不属于 `dev`、`build` 或运行流程，不读取当前时间且不使用随机数。

## 输入、输出和错误

主输入支持：

- A/B/C 公司及 MOCK-A/B/C。
- 股价、价格、收盘价；成交量、交易量；涨跌幅。
- 最近 2～60 个交易日，或 `YYYY-MM-DD 到 YYYY-MM-DD`。
- 折线图、柱状图，以及涨跌幅/成交量最高或最低 N 日。

成功输出包括：合法 Schema、实际数据范围、派生序列、极值、Insight facts、结论文案和数据来源。

错误使用稳定错误码并包含修复建议。追问相关错误包括：

- `EMPTY_QUERY` / `QUERY_TOO_LONG`：输入为空或超出长度限制。
- `UNKNOWN_STOCK` / `UNKNOWN_METRIC`：股票或指标不在支持范围。
- `AMBIGUOUS_QUERY`：完整指令同时包含冲突图表类型或多个时间范围。
- `INVALID_RANGE` / `INVALID_DATE_RANGE`：交易日数量或明确日期范围非法。
- `NO_DATA` / `INSUFFICIENT_DATA`：范围内无数据或缺少计算上下文。
- `SCHEMA_INVALID` / `CHART_CONFIG_INVALID`：Schema 或图表配置未通过边界校验。
- `FOLLOW_UP_WITHOUT_CONTEXT`：没有最近一次成功 Schema。
- `FOLLOW_UP_LIMIT_REACHED`：当前上下文已经成功修改一次。
- `AMBIGUOUS_FOLLOW_UP`：一次追问包含多个修改要求。
- `UNSUPPORTED_FOLLOW_UP`：修改类型不支持，或目标指标不在当前图表中。
- `UNEXPECTED_ERROR`：未预期异常被安全转换为可解释错误，避免界面卡死或白屏。
- `DATA_SOURCE_UNAVAILABLE`：外部数据源未连接或调用失败；组合 Provider 可自动回退到 Mock。

## 测试

测试覆盖：

- 5 条指令与冻结 fixture 完全一致。
- Schema 正常及失败校验。
- 三只股票的数据数量、日期、OHLC 和唯一性。
- 最近 N 日、指定日期和空数据查询。
- 涨跌幅及成交量 Top/Bottom N。
- Insight facts 与实际查询结果一致。
- 两种追问成功修改及重新查询计算。
- 无上下文、冲突、不支持、范围非法和追问次数限制。
- UI 主流程、Schema Viewer、结论、错误提示和 Error Boundary。
- 问财未连接状态、自动 Mock 回退和实际数据来源标记。

## 问财 Skill Hub 探测结果

本项目只记录已实际核验的边界，不把公开示例当作已成功连接：

- 官方同花顺金融数据文档列出了 A 股 MCP 服务 `hithink-finance-a-share`，历史行情工具为 `get_a_share_prices_historical`；参数包含真实证券 `thscode`、`interval`、`start`、`end`，可选 `adjust`、`offset`。
- REST 等价端点是 `GET /api/a-share/prices/historical`，使用 `X-api-key`；本次无凭据探测实际返回 HTTP 200 和业务错误 `code=2003`、`Missing X-api-key`。
- 当前运行环境没有问财/同花顺插件或 MCP 连接，官方文档指定的 `HITHINK_FINANCE_API_KEY` 也未配置，因而无法验证成功响应和当前账户权限。
- 当前 `DashboardSchema v1` 只接受虚构股票 `MOCK-A/B/C`；官方行情工具要求真实 `thscode`。把虚构公司暗中映射为真实股票会造成数据语义错误，因此没有这样做。
- 浏览器端不保存或注入 API Key。只有在宿主环境提供经过真实成功调用验证、能输出标准 `StockSeries` 的安全桥接后，才应替换当前未连接适配器。

核验依据：[Agent Skill 快速开始](https://fuyao.aicubes.cn/docs/developer-tools/agent-skill/)、[MCP 接入与认证契约](https://github.com/HiThink-Tech/Financial-API/blob/main/docs/mcp.md)、[A 股历史行情参数与响应字段](https://github.com/HiThink-Tech/Financial-API/blob/main/skills/hithink-finance/references/api/endpoints-prices.md)。

## 项目结构

```text
src/
├─ app/                 # 页面与工作流状态
├─ components/          # 输入、流程、图表、Schema、错误组件
├─ data/                # 固定模拟行情与 manifest
├─ domain/              # Schema、实体、指标、错误和日期契约
├─ infrastructure/      # DataProvider 与本地实现
└─ services/            # 解析、追问、计算、结论和用例编排
tests/
├─ data/
├─ fixtures/
├─ schema/
├─ services/
└─ ui/
```

## Demo 演示流程

建议按以下顺序进行一轮约 5 分钟演示：

1. 打开首页，说明固定 Mock 数据、Schema v1、离线可复现和免责声明。
2. 运行样例 1，展示四阶段状态、两类 ECharts、三个最大跌幅标注、精确单位 Tooltip、Insight 和实际数据来源。
3. 展开 Schema Viewer，核对股票、30 个交易日、指标、图表、标注、数据版本和截止时间。
4. 依次点击样例 2～5，快速展示单折线、单成交量柱状图、涨跌幅正负柱和明确日期范围双图。
5. 重新运行样例 1，执行“把成交量改成涨跌幅”，展示 Schema、图表和结论同步更新。
6. 再次运行样例 1，执行“改为最近 10 天”，展示实际范围变为 `2025-03-18` 至 `2025-03-31`。
7. 输入“分析 A 公司最近 10 天的市盈率”，展示结构化错误、修复建议，以及上一次成功看板仍被保留。

最终交付验收已在真实 Chrome 中检查 1440px 桌面和 375px 窄屏：页面无横向溢出，折线、柱状、极值 pin、Tooltip 和错误状态均可见；5 条样例 Schema 与 fixture 一致，浏览器控制台无未处理异常。

## 已知限制

- 仅支持预定义中文表达和少量同义词，不是通用自然语言系统。
- 只支持单股票分析，不支持多股票比较。
- 追问只允许基于最近一次成功结果修改一次，且仅支持指标替换或最近 N 日范围。
- 不支持真实行情、K 线、复权、财务指标、账户、持久化和自由布局。
- 问财适配层当前处于“已探测、未连接”状态；没有成功调用凭据、真实证券 Schema 和安全服务端桥接前，只使用 Mock 回退。
- 模拟交易日只排除周末，不模拟真实交易所节假日。
- 仓库内 UI 自动化使用 jsdom 图表组件替身验证页面编排；ECharts Canvas 已在最终交付时用真实 Chrome 验收，但未引入额外的浏览器测试依赖。

完整需求、边界和优先级见 [`REQUIRE.md`](./REQUIRE.md)。Agent 协作和关键决策记录见 [`AGENT_LOG.md`](./AGENT_LOG.md)。
