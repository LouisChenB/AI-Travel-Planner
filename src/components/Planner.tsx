import { useMemo, useState } from 'react'
import { transcribeOnce } from '../utils/voice'
import { generateItinerary } from '../api/llm'
import type { Itinerary, TripPreferences } from '../types'
import { savePlan } from '../api/supabase'
import MapView from './MapView'

export default function Planner() {
  const [destination, setDestination] = useState('中国 江苏 南京')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState(10000)
  const [people, setPeople] = useState(2)
  const [withKids, setWithKids] = useState(false)
  const [interests, setInterests] = useState('美食, 动漫')
  const [loading, setLoading] = useState(false)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [recognizedText, setRecognizedText] = useState<string>('')

  const prefs: TripPreferences = useMemo(() => ({
    destination,
    startDate,
    endDate,
    budget,
    people,
    interests: interests.split(',').map(s => s.trim()).filter(Boolean),
    withKids,
  }), [destination, startDate, endDate, budget, people, interests, withKids])

  const speakFill = async () => {
    console.log('Planner: 开始语音识别填充偏好')
    try {
      const text = await transcribeOnce('zh-CN')
      console.log('Planner: 识别文本', text)

      const parseChineseNumber = (raw: string): number => {
        const s = raw.replace(/两/g, '二').trim()
        if (/^\d+$/.test(s)) return parseInt(s, 10)
        const digits: Record<string, number> = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 零:0 }
        if (s === '十') return 10
        if (s.startsWith('十')) {
          const r = digits[s[1]] ?? 0
          return 10 + r
        }
        if (s.includes('十')) {
          const [l, r] = s.split('十')
          const ln = digits[l] ?? 0
          const rn = r ? (digits[r] ?? 0) : 0
          return ln * 10 + rn
        }
        return digits[s] ?? 0
      }
      const pad2 = (n: number) => String(n).padStart(2, '0')
      const currentYear = new Date().getFullYear()
      const normalizeYear = (y: string | undefined, fallback: number) => {
        if (!y) return fallback
        const n = parseInt(y, 10)
        if (y.length === 2) return 2000 + n
        if (y.length === 4) return n
        return fallback
      }

      const textNorm = text.replace(/\s+/g, '')

      // 目的地：支持“前往/去/到”，遇到边界词或标点截断；排除日期里的“到”
      // 目的地：优先匹配“前往/去”，仅当不跟随日期时才允许“到”
      const destKeywordReg = /(前往|去|到)(?!(?:\d{2,4}年)?\d{1,2}月)/
      const mDest = destKeywordReg.exec(textNorm)
      if (mDest) {
        const keyword = mDest[1]
        const start = mDest.index
        const rest = textNorm.slice(start + keyword.length)
    
        const boundaryRegs = [
          /[，,。]/,
          /预算/,
          /喜欢/,
          /不带孩子/,
          /带孩子/,
          /[一二两三四五六七八九十\d]+个?人/,
          /\d+天/,
          /(\d{2,4})?年?\d{1,2}月\d{1,2}(?:日|号)?/
        ]
        let cut = rest.length
        for (const re of boundaryRegs) {
          const m = rest.match(re)
          if (m?.index !== undefined && m.index < cut) cut = m.index
        }
    
        const dest = rest.slice(0, cut).trim()
        if (dest) {
          setDestination(dest)
          console.log('Planner: 解析目的地 ->', dest)
        }
      }

      // 日期范围：支持 “YYYY年MM月DD日 至/到/~/-/— YYYY年MM月DD日”，年份可省略或用两位数；跨年自动推断
      // 通用匹配：两端的年份均为可选
      // 日期范围：支持“日/号”
      const reRange = /(?:(\d{2,4})年)?(\d{1,2})月(\d{1,2})(?:日|号)?(?:至|~|到|—|-)(?:(\d{2,4})年)?(\d{1,2})月(\d{1,2})(?:日|号)?/
      const mRange = textNorm.match(reRange)
      if (mRange) {
        const y1 = normalizeYear(mRange[1], currentYear)
        const m1 = parseInt(mRange[2], 10)
        const d1 = parseInt(mRange[3], 10)
        let y2 = normalizeYear(mRange[4], y1)
        const m2 = parseInt(mRange[5], 10)
        const d2 = parseInt(mRange[6], 10)

        // 如果第二段年份省略且明显跨年（end month < start month 或月相等但日更小），推断为下一年
        if (!mRange[4]) {
          if (m2 < m1 || (m2 === m1 && d2 < d1)) {
            y2 = y1 + 1
          }
        }

        setStartDate(`${y1}-${pad2(m1)}-${pad2(d1)}`)
        setEndDate(`${y2}-${pad2(m2)}-${pad2(d2)}`)
        console.log('Planner: 解析日期范围 ->', `${y1}-${pad2(m1)}-${pad2(d1)} 至 ${y2}-${pad2(m2)}-${pad2(d2)}`)
      }

      // 预算：预算 X 万元 / 预算 XXXX 元
      const budgetMatch = textNorm.match(/预算([0-9]+(?:\.[0-9]+)?)(万)?元/)
      if (budgetMatch) {
        const val = parseFloat(budgetMatch[1])
        const isWan = !!budgetMatch[2]
        const final = Math.round(val * (isWan ? 10000 : 1))
        setBudget(final)
        console.log('Planner: 解析预算 ->', final)
      }

      // 人数：两个人 / 3人 / 三人
      const peopleMatch = textNorm.match(/([一二两三四五六七八九十\d]+)个?人/)
      if (peopleMatch) {
        const p = parseChineseNumber(peopleMatch[1])
        if (p > 0) {
          setPeople(p)
          console.log('Planner: 解析人数 ->', p)
        }
      }

      // 偏好：喜欢美食和美景
      const interestsMatch = text.match(/喜欢([^\，,。]+)/)
      if (interestsMatch) {
        const prefs = interestsMatch[1]
          .replace(/[。]/g, '')
          .split(/[、和,，]/)
          .map(s => s.trim())
          .filter(Boolean)
          .join(', ')
        setInterests(prefs)
        console.log('Planner: 解析偏好 ->', prefs)
      }

      // 是否带孩子：带孩子 / 不带孩子
      const kidsNo = /不带孩子/.test(textNorm)
      const kidsYes = /带孩子/.test(textNorm) && !kidsNo
      if (kidsYes || kidsNo) {
        setWithKids(kidsYes)
        console.log('Planner: 解析是否带孩子 ->', kidsYes ? '是' : '否')
      }

      // 将原来的 alert 改为页面显示
      setRecognizedText(text)
    } catch (e: any) {
      console.error('Planner: 语音识别或解析失败', e)
      alert(e.message ?? '语音识别失败')
    }
  }

  const plan = async () => {
    console.log('Planner: 生成行程', prefs)
    setLoading(true)
    try {
      const res = await generateItinerary(prefs)
      setItinerary(res)
    } catch (e: any) {
      console.error('Planner: 生成行程失败', e)
      alert(e.message ?? '生成行程失败')
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    console.log('Planner: 保存行程到云端')
    if (!itinerary) return
    try {
      await savePlan(itinerary, prefs.budget)
      alert('已保存到云端')
    } catch (e: any) {
      console.error('Planner: 保存失败', e)
      alert(e.message ?? '保存失败，请确认已登录且配置了 Supabase')
    }
  }

  return (
    <div className="page">
      <h2>智能行程规划</h2>

      <div className="panel">
        <div className="panel-title">快速语音输入</div>
        <div className="analysis">
          <div><b>语音输入示例：</b></div>
          <div>示例一：我计划于11月20日至11月27日前往浙江杭州，预算 1 万元，两个人一起去，喜欢美食和美景</div>
          <div>示例二：我想去日本东京，5 天，预算 1 万元，喜欢美食和动漫，带孩子</div>
          <div style={{ marginTop: 6 }}>
            <b>可识别要素：</b>
            <ul>
              <li>日期范围（如“11月20日至11月27日”）</li>
              <li>目的地（如“前往浙江杭州”）</li>
              <li>预算（如“预算 1 万元”或“预算 8000 元”）</li>
              <li>人数（如“两个人/3人/三人”）</li>
              <li>偏好（如“喜欢美食和美景”）</li>
              <li>是否带孩子（“带孩子/不带孩子”）</li>
            </ul>
            识别后可在下方表单中手动微调。
          </div>
        </div>
        <div className="analysis">
          <strong>识别到的文本：</strong>
          <span>{recognizedText || '（识别完成后将在此显示）'}</span>
        </div>
        <div className="row voice-row">
          <button className="btn-voice" onClick={speakFill}>🎤 语音填写</button>
          <span className="hint">按下后说出完整需求（示例见上）</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">填写出行偏好</div>
        <div className="form">
          <div className="row">
            <label>目的地</label>
            <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="例如：日本 东京" />
          </div>

          <div className="row two-cols">
            <div className="col">
              <label>开始日期</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="col">
              <label>结束日期</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="row two-cols">
            <div className="col">
              <label>预算（元）</label>
              <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} />
            </div>
            <div className="col">
              <label>同行人数</label>
              <input type="number" value={people} onChange={e => setPeople(Number(e.target.value))} />
            </div>
          </div>

          <label>偏好</label>
          <input value={interests} onChange={e => setInterests(e.target.value)} placeholder="用逗号分隔，例如：美食, 动漫" />

          <div className="row">
            <label className="checkbox">
              <input type="checkbox" checked={withKids} onChange={e => setWithKids(e.target.checked)} />
              <span>带孩子</span>
            </label>
          </div>

          <div className="row">
            <button className="btn-primary" onClick={plan} disabled={loading}>{loading ? '生成中...' : '生成行程'}</button>
            <button className="btn-secondary" onClick={save} disabled={!itinerary}>保存到云端</button>
          </div>
        </div>
      </div>

      {itinerary && (
        <>
          <div className="panel">
            <div className="panel-title">行程概览：{itinerary.destination}</div>
            <div className="itinerary">
              {itinerary.days?.map((d, i) => (
                <div key={i} className="day">
                  <div className="day-title">{d.date}</div>
                  <ul>
                    {d.activities?.map((a, j) => (
                      <li key={j}>
                        <span className="time">{a.time}</span>
                        <span className="title">{a.title}</span>
                        {a.address ? <span className="address">{a.address}</span> : null}
                        {typeof a.costEstimate === 'number' ? <span className="cost">¥{a.costEstimate}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">地图</div>
            <MapView itinerary={itinerary} />
          </div>
        </>
      )}
    </div>
  )
}
