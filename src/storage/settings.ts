import type { Settings } from '../types'

const KEY = 'ai-travel-settings'

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function setSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function hasLLM(): boolean {
  const s = getSettings()
  return !!(s.llmBaseUrl && s.llmApiKey && s.llmModel)
}

export function hasSupabase(): boolean {
  const s = getSettings()
  return !!(s.supabaseUrl && s.supabaseAnonKey)
}

export function hasAmap(): boolean {
  const s = getSettings()
  return !!s.amapKey
}

// 新增：是否配置了科大讯飞听写
export function hasXFYun(): boolean {
  const s = getSettings()
  return !!(s.xfyAppId && s.xfyApiKey && s.xfyApiSecret)
}