import { useEffect, useState } from 'react'
import { getSettings, setSettings } from '../storage/settings'
import { createSupabaseClient } from '../api/supabase'

export default function Settings() {
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [amapKey, setAmapKey] = useState('')
  const [amapSecurityJsCode, setAmapSecurityJsCode] = useState('')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('')
  // 新增：科大讯飞
  const [xfyAppId, setXfyAppId] = useState('')
  const [xfyApiKey, setXfyApiKey] = useState('')
  const [xfyApiSecret, setXfyApiSecret] = useState('')

  useEffect(() => {
    const s = getSettings()
    console.log('Settings: 加载本地设置', s)
    setLlmBaseUrl(s.llmBaseUrl ?? '')
    setLlmApiKey(s.llmApiKey ?? '')
    setLlmModel(s.llmModel ?? '')
    setAmapKey(s.amapKey ?? '')
    setAmapSecurityJsCode(s.amapSecurityJsCode ?? '')
    setSupabaseUrl(s.supabaseUrl ?? '')
    setSupabaseAnonKey(s.supabaseAnonKey ?? '')
    setXfyAppId(s.xfyAppId ?? '')
    setXfyApiKey(s.xfyApiKey ?? '')
    setXfyApiSecret(s.xfyApiSecret ?? '')
  }, [])

  const save = () => {
    console.log('Settings: 保存设置')
    setSettings({
      llmBaseUrl, llmApiKey, llmModel,
      amapKey, amapSecurityJsCode,
      supabaseUrl, supabaseAnonKey,
      xfyAppId, xfyApiKey, xfyApiSecret,
    })
    if (supabaseUrl && supabaseAnonKey) {
      console.log('Settings: 初始化 Supabase 客户端')
      createSupabaseClient(supabaseUrl, supabaseAnonKey)
    }
    alert('已保存设置')
  }

  return (
    <div className="page">
      <h2>设置</h2>
      <div className="form">
        <h3>大模型</h3>
        <label>Base URL</label>
        <input value={llmBaseUrl} onChange={e => setLlmBaseUrl(e.target.value)} placeholder="例如：https://api.openai.com" />
        <label>API Key</label>
        <input value={llmApiKey} onChange={e => setLlmApiKey(e.target.value)} placeholder="在此粘贴你的 API Key" />
        <label>Model</label>
        <input value={llmModel} onChange={e => setLlmModel(e.target.value)} placeholder="例如：gpt-4o-mini / glm-4 / deepseek-chat" />

        <h3>地图（高德）</h3>
        <label>AMap Key</label>
        <input value={amapKey} onChange={e => setAmapKey(e.target.value)} placeholder="在高德控制台申请的 Web JS API Key" />
        <label>AMap Security JS Code</label>
        <input value={amapSecurityJsCode} onChange={e => setAmapSecurityJsCode(e.target.value)} placeholder="在高德控制台申请的 Web JS API Security JS Code" />

        <h3>Supabase</h3>
        <label>Supabase URL</label>
        <input value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="https://xxxxx.supabase.co" />
        <label>Supabase Anon Key</label>
        <input value={supabaseAnonKey} onChange={e => setSupabaseAnonKey(e.target.value)} placeholder="你的匿名 Key" />

        <h3>科大讯飞（语音识别）</h3>
        <label>AppID</label>
        <input value={xfyAppId} onChange={e => setXfyAppId(e.target.value)} placeholder="讯飞开放平台应用 AppID" />
        <label>API Key</label>
        <input value={xfyApiKey} onChange={e => setXfyApiKey(e.target.value)} placeholder="讯飞开放平台 API Key" />
        <label>API Secret</label>
        <input value={xfyApiSecret} onChange={e => setXfyApiSecret(e.target.value)} placeholder="讯飞开放平台 API Secret" />

        <button onClick={save}>保存</button>
      </div>
      <p>密钥仅保存在浏览器本地，不会写入代码或提交到云端。</p>
    </div>
  )
}