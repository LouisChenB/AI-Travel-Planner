import { useEffect, useMemo, useState } from 'react'
import { transcribeOnce } from '../utils/voice'
import { parseExpenseFromText, analyzeBudget } from '../api/llm'
import type { Expense, BudgetAnalysis } from '../types'
import { listExpenses, saveExpense, listPlans } from '../api/supabase'

export default function Expenses() {
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(undefined)
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('餐饮')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [currency, setCurrency] = useState('CNY')
  const [voiceText, setVoiceText] = useState('')
  const [list, setList] = useState<Expense[]>([])
  const [analysis, setAnalysis] = useState<BudgetAnalysis | null>(null)
  const plannedBudget = useMemo(() => {
    const plan = plans.find(p => p.id === selectedPlanId)
    return plan?.planned_budget ?? 0
  }, [plans, selectedPlanId])

  useEffect(() => {
    console.log('Expenses: 拉取计划列表')
    listPlans().then(setPlans).catch((err) => {
      console.error('Expenses: 拉取计划失败', err)
    })
  }, [])

  useEffect(() => {
    console.log('Expenses: 拉取开销列表', selectedPlanId)
    listExpenses(selectedPlanId).then(setList).catch((err) => {
      console.error('Expenses: 拉取开销失败', err)
    })
  }, [selectedPlanId])

  const speak = async () => {
    console.log('Expenses: 开始语音记录')
    try {
      const text = await transcribeOnce('zh-CN')
      setVoiceText(text)
    } catch (e: any) {
      console.error('Expenses: 语音识别失败', e)
      alert(e.message ?? '语音识别失败')
    }
  }

  const aiParse = async () => {
    console.log('Expenses: AI 解析语音文本', voiceText)
    if (!voiceText) return
    try {
      const exp = await parseExpenseFromText(voiceText)
      setDate(exp.date)
      setCategory(exp.category)
      setDescription(exp.description)
      setAmount(exp.amount)
      setCurrency(exp.currency ?? 'CNY')
    } catch (e: any) {
      console.error('Expenses: AI 解析失败', e)
      alert(e.message ?? 'AI 解析失败')
    }
  }

  const addExpense = async () => {
    console.log('Expenses: 保存开销')
    if (!date || !category || !description || !amount) {
      alert('请填写完整信息')
      return
    }
    try {
      const saved = await saveExpense({ date, category, description, amount, currency }, selectedPlanId)
      setList([saved, ...list])
      setDate(''); setCategory('餐饮'); setDescription(''); setAmount(0)
    } catch (e: any) {
      console.error('Expenses: 保存开销失败', e)
      alert(e.message ?? '保存失败，请确认已登录且配置了 Supabase')
    }
  }

  const doAnalyze = async () => {
    console.log('Expenses: 开始预算分析，总预算', plannedBudget)
    try {
      const res = await analyzeBudget(list, plannedBudget)
      setAnalysis(res)
    } catch (e: any) {
      console.error('Expenses: 预算分析失败', e)
      alert(e.message ?? '预算分析失败')
    }
  }

  return (
    <div className="page">
      <h2>费用预算与管理</h2>
      <div className="form">
        <label>选择计划</label>
        <select value={selectedPlanId ?? ''} onChange={e => setSelectedPlanId(e.target.value || undefined)}>
          <option value="">未选择</option>
          {plans.map(p => (
            <option key={p.id} value={p.id}>{p.destination}（预算¥{p.planned_budget}）</option>
          ))}
        </select>

        <div className="row">
          <button onClick={speak}>语音记录</button>
          <input value={voiceText} onChange={e => setVoiceText(e.target.value)} placeholder="例如：今天午餐花了150元" />
          <button onClick={aiParse} disabled={!voiceText}>AI 解析</button>
        </div>

        <label>日期</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <label>类别</label>
        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="餐饮/交通/住宿/购物/门票等" />
        <label>描述</label>
        <input value={description} onChange={e => setDescription(e.target.value)} />
        <label>金额</label>
        <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} />
        <label>币种</label>
        <input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="CNY/JPY/USD..." />
        <button onClick={addExpense}>保存开销</button>
      </div>

      <h3>开销列表</h3>
      <table className="table">
        <thead>
          <tr><th>日期</th><th>类别</th><th>描述</th><th>金额</th><th>币种</th></tr>
        </thead>
        <tbody>
          {list.map((e, i) => (
            <tr key={i}>
              <td>{e.date}</td>
              <td>{e.category}</td>
              <td>{e.description}</td>
              <td>{e.amount}</td>
              <td>{e.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row">
        <button onClick={doAnalyze}>AI 预算分析</button>
      </div>
      {analysis && (
        <div className="analysis">
          <div>总开销：¥{analysis.total}</div>
          <div>是否超支：{analysis.overBudget ? '是' : '否'}</div>
          <div>分类统计：</div>
          <ul>
            {Object.entries(analysis.byCategory).map(([k, v]) => <li key={k}>{k}: ¥{v}</li>)}
          </ul>
          <div>建议：</div>
          <ul>
            {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}