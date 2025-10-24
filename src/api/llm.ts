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
    content: '你是旅行规划专家。返回 JSON 格式的行程计划，不包含额外文本。',
  }
  const user: ChatMessage = {
    role: 'user',
    content: `请为以下需求生成行程：目的地：${prefs.destination}；日期：${prefs.startDate} 至 ${prefs.endDate}；预算：${prefs.budget}；人数：${prefs.people}；偏好：${prefs.interests.join('、')}；是否带孩子：${prefs.withKids ? '是' : '否'}。请返回 JSON，包含字段：destination, days[{date, activities[{time,title,type,address,lat,lng,notes,costEstimate}]}], hotelRecommendations[], restaurantRecommendations[], transportAdvice, tips[], totalBudgetEstimate。`,
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
    content: '你是旅行费用分析助手。返回 JSON 格式的预算分析。',
  }
  const user: ChatMessage = {
    role: 'user',
    content: `请基于以下开销和预算进行分析并返回 JSON：预算=${plannedBudget}；开销（JSON 数组）=${JSON.stringify(expenses)}；需要字段：total, byCategory(对象), overBudget(布尔), suggestions(数组)。`,
  }
  const raw = await chat([sys, user])
  try {
    const json = raw.trim().match(/\{[\s\S]*\}/)?.[0] ?? raw
    return JSON.parse(json)
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