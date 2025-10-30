import type { BudgetAnalysis, Itinerary, TripPreferences, Expense } from '../types'
import { getSettings } from '../storage/settings'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function chat(messages: ChatMessage[]) {
  const s = getSettings()
  if (!s.llmBaseUrl || !s.llmApiKey || !s.llmModel) {
    throw new Error('请在设置页配置 LLM Base URL、API Key 和 Model')
  }
  const resp = await fetch(s.llmBaseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${s.llmApiKey}`,
    },
    body: JSON.stringify({
      model: s.llmModel,
      messages,
      temperature: 0.2,
    }),
  })
  if (!resp.ok) {
    console.error('LLM: 接口错误', resp.status, resp.statusText)
    throw new Error(`LLM 接口错误：${resp.status} ${resp.statusText}`)
  }
  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content ?? ''
  return content
}

export async function generateItinerary(prefs: TripPreferences): Promise<Itinerary> {
  const sys: ChatMessage = {
    role: 'system',
    content: `你是旅行规划专家，只能返回严格 JSON（无额外文本/Markdown）。格式如下，并严格遵循字段与类型：
{
  "destination": "中国 江苏 南京",
  "origin": "上海",
  "days": [
    {
      "date": "2025-10-01",
      "activities": [
        { "time": "08:00", "title": "抵达南京", "type": "transport", "from": "上海", "to": "南京", "method": "高铁", "fromLat": 31.2304, "fromLng": 121.4737, "toLat": 32.0603, "toLng": 118.7969, "departTime": "08:00", "arriveTime": "09:30", "steps": ["步行至地铁站","乘坐地铁至虹桥火车站","乘坐Gxxx高铁至南京南"], "duration": "1.5h", "costEstimate": 150, "isArrival": true },
        { "time": "09:45", "title": "早餐 · 鸭血粉丝汤", "type": "food", "name": "鸭血粉丝汤（某店）", "address": "南京市xx区xx路", "costEstimate": 30 },
        { "time": "10:30", "title": "前往中山陵", "type": "transport", "from": "早餐店", "to": "中山陵", "method": "地铁+步行", "fromLat": 32.0500, "fromLng": 118.7800, "toLat": 32.0608, "toLng": 118.8489, "steps": ["步行至地铁站","乘坐x号线至xx站","步行至中山陵"], "duration": "40min", "costEstimate": 8 },
        { "time": "11:20", "title": "游览 · 中山陵", "type": "sightseeing", "name": "中山陵", "address": "南京市玄武区紫金山南麓", "intro": "中国近代伟人孙中山先生的陵寝", "costEstimate": 0 },
        { "time": "18:00", "title": "返程 · 回上海", "type": "transport", "from": "南京", "to": "上海", "method": "高铁", "fromLat": 32.0603, "fromLng": 118.7969, "toLat": 31.2304, "toLng": 121.4737, "departTime": "18:00", "arriveTime": "19:30", "steps": ["抵达南京南","乘坐Gxxx高铁至上海虹桥"], "duration": "1.5h", "costEstimate": 150, "isDeparture": true }
      ]
    }
  ],
  "totalBudgetEstimate": 8000,
  "tips": ["尽量避开早晚高峰"]
}

字段说明：
- 顶层：
  - destination（字符串）、origin（字符串）、days（数组）、totalBudgetEstimate（数字）、tips（字符串数组）。
- 每天（Day）：
  - date（YYYY-MM-DD）、activities（按 time 升序的数组）。
- 活动（Activity 联合类型）：
  - 通用：time（HH:mm）、title（字符串）、type（枚举：transport|sightseeing|food|shopping|hotel|other）、notes（可选）、costEstimate（数字）。
  - transport：from、to、method、fromLat（数字）、fromLng（数字）、toLat（数字）、toLng（数字）、steps（字符串数组，可选）、duration（字符串）、departTime/arriveTime（字符串）、isArrival/isDeparture（布尔）。必须提供经纬度，地图导航仅使用坐标。
  - sightseeing：name、address、lat/lng（数字，可选）、intro（景点介绍）。
  - food：name、address、lat/lng（数字，可选）、intro（美食/餐厅介绍）。
  - shopping：name、address、lat/lng（数字，可选）、intro（购物地点介绍）。
  - hotel：name、address、lat/lng（数字，可选）、breakfastIncluded（布尔）。
  - other：name/address/intro。

约束与规则：
- 每个活动必须包含 time（HH:mm）、title、type、costEstimate（数字，估算费用），各个活动按时间顺序排列。
- 首日以“抵达”的 transport 开场（from=出发地，to=目的地）；末日以“返程”的 transport 结束（from=目的地，to=出发地）。
- 餐饮/景点之间的移动用 transport 活动表示。
- transport 活动必须提供 fromLat/fromLng/toLat/toLng，并与 from/to 一致，导航仅使用这些坐标。
- 只返回上述 JSON，不要返回任何额外文本或 Markdown。`,
  }
  const user: ChatMessage = {
    role: 'user',
    content: `
请根据以下偏好生成每日按时间排序的活动序列（交通也作为活动）：
- 出发地：${prefs.origin || '未指定'}
- 目的地：${prefs.destination}
- 开始日期：${prefs.startDate || '未指定'}
- 结束日期：${prefs.endDate || '未指定'}
- 预算：¥${prefs.budget}
- 人数：${prefs.people}
- 偏好：${(prefs.interests || []).join('，')}
- 是否带孩子：${prefs.withKids ? '是' : '否'}

请严格按系统消息中的 JSON 格式与字段约定返回内容；所有活动必须包含 time，transport 活动必须包含 fromLat/fromLng/toLat/toLng 并与 from/to 一致，导航仅使用这些坐标。`.trim(),
  }
  const raw = await chat([sys, user])
  try {
    const json = raw.trim().match(/\{[\s\S]*\}/)?.[0] ?? raw
    return JSON.parse(json)
  } catch (err) {
    console.error('LLM: 行程 JSON 解析失败', err, raw)
    throw new Error('LLM 返回内容解析失败，请调整模型或稍后重试。')
  }
}

export async function analyzeBudget(expenses: Expense[], plannedBudget: number): Promise<BudgetAnalysis> {
  const sys: ChatMessage = {
    role: 'system',
    content: `
你是旅行费用分析助手。只返回严格 JSON，不要包含任何额外文本或 Markdown。
必须包含字段：
- totalSpent（数字，当前已花费总额）
- plannedBudget（数字，总预算）
- remainingBudget（数字，剩余预算 = plannedBudget - totalSpent）
- overBudget（布尔，是否超支）
- byCategory（对象，各分类汇总，如 {"餐饮": 1200, "交通": 800}）
- summary（字符串，中文报告摘要，涵盖总预算、已花费、剩余/超出、主要支出类别）
- suggestions（字符串数组，3-6条可执行建议）
`.trim(),
  }
  const user: ChatMessage = {
    role: 'user',
    content: `
请基于以下开销和总预算进行分析并返回 JSON：
- 总预算：${plannedBudget}
- 已有开销（JSON 数组）：${JSON.stringify(expenses)}

请计算 totalSpent、remainingBudget、byCategory，并给出 summary（中文报告）与 suggestions（详细的注意事项、具体可执行建议等）。只返回上述 JSON。`.trim(),
  }
  const raw = await chat([sys, user])
  try {
    const json = raw.trim().match(/\{[\s\S]*\}/)?.[0] ?? raw
    const data = JSON.parse(json)

    // 安全映射到现有类型 BudgetAnalysis
    const computedTotal = (expenses ?? []).reduce((sum, e) => sum + (e?.amount ?? 0), 0)
    const totalSpent: number = typeof data.totalSpent === 'number' ? data.totalSpent : computedTotal
    const byCategory: Record<string, number> =
      (data.byCategory && typeof data.byCategory === 'object') ? data.byCategory :
      (expenses ?? []).reduce((acc: Record<string, number>, e: Expense) => {
        const k = e?.category ?? '未分类'
        acc[k] = (acc[k] ?? 0) + (e?.amount ?? 0)
        return acc
      }, {})
    const overBudget: boolean =
      typeof data.overBudget === 'boolean' ? data.overBudget : (totalSpent > plannedBudget)

    const suggestions: string[] = Array.isArray(data.suggestions) ? data.suggestions : []
    if (typeof data.summary === 'string' && data.summary.trim()) {
      suggestions.unshift(data.summary.trim())
    }

    return {
      total: totalSpent,
      byCategory,
      overBudget,
      suggestions,
    }
  } catch (err) {
    console.error('LLM: 预算 JSON 解析失败', err, raw)
    throw new Error('LLM 返回内容解析失败。')
  }
}

export async function parseExpenseFromText(text: string): Promise<Expense> {
  const sys: ChatMessage = {
    role: 'system',
    content: '从自然语言中解析单条旅行开销为 JSON：{date, category, description, amount, currency}，日期为YYYY-MM-DD。',
  }
  const user: ChatMessage = { role: 'user', content: `文本：${text}` }
  const raw = await chat([sys, user])
  try {
    const json = raw.trim().match(/\{[\s\S]*\}/)?.[0] ?? raw
    return JSON.parse(json)
  } catch (err) {
    console.error('LLM: 开销解析失败', err, raw)
    throw new Error('解析开销失败，请手动填写或重试。')
  }
}