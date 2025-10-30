import { useEffect, useState } from 'react'
import { listPlans, deletePlan, updatePlan } from '../api/supabase'
import type { Itinerary, DayPlan, Activity } from '../types'
import MapView from './MapView'

export default function PlanManager() {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  // 查看与编辑的分离状态
  const [viewId, setViewId] = useState<string | null>(null)
  const [viewPlan, setViewPlan] = useState<any | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBudget, setEditBudget] = useState<number>(0)
  const [editItinerary, setEditItinerary] = useState<Itinerary | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const list = await listPlans()
      setPlans(list)
    } catch (e: any) {
      console.error('PlanManager: 拉取计划失败', e)
      alert(e.message ?? '拉取计划失败，请确认已登录且配置了 Supabase')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('PlanManager: 初始化加载计划列表')
    refresh()
  }, [])

  // 查看与编辑的触发
  // 点击“查看”时，先关闭编辑，再显示查看
  const startView = (p: any) => {
    setEditingId(null)
    setEditItinerary(null)
    setViewId(p.id)
    setViewPlan(p)
  }

  // 点击“编辑”时，先关闭查看，再显示编辑
  const startEdit = (p: any) => {
    setViewId(null)
    setViewPlan(null)
    setEditingId(p.id)
    setEditBudget(Number(p.planned_budget ?? 0))
    const content: Itinerary = p.content ?? { destination: p.destination ?? '', days: [] }
    setEditItinerary(content)
  }

  // 活动类型中文标签
  const typeLabel = (t: Activity['type'] | undefined) => {
    switch (t) {
      case 'sightseeing': return '景点'
      case 'food': return '美食'
      case 'shopping': return '购物'
      case 'transport': return '交通'
      case 'hotel': return '住宿'
      default: return '其他'
    }
  }

  const submitEdit = async () => {
    if (!editingId || !editItinerary) return
    console.log('PlanManager: 提交编辑', editingId)
    try {
      await updatePlan(editingId, {
        destination: editItinerary.destination,
        plannedBudget: editBudget,
        content: editItinerary,
      })
      setEditingId(null)
      setEditItinerary(null)
      await refresh()
    } catch (e: any) {
      console.error('PlanManager: 更新失败', e)
      alert(e.message ?? '更新失败，请稍后重试')
    }
  }

  const removePlan = async (id: string) => {
    if (!confirm('确认删除该规划？')) return
    // 关闭查看/编辑面板（互斥隐藏）
    setViewId(null)
    setViewPlan(null)
    setEditingId(null)
    setEditItinerary(null)

    console.log('PlanManager: 删除规划', id)
    try {
      await deletePlan(id)
      await refresh()
    } catch (e: any) {
      console.error('PlanManager: 删除失败', e)
      alert(e.message ?? '删除失败，请稍后重试')
    }
  }

  // 结构化编辑：目的地
  const setDest = (v: string) => {
    if (!editItinerary) return
    setEditItinerary({ ...editItinerary, destination: v })
  }
  const setOrigin = (v: string) => {
    if (!editItinerary) return
    setEditItinerary({ ...editItinerary, origin: v })
  }

  // 天列表操作
  const addDay = () => {
    if (!editItinerary) return
    const newDay: DayPlan = { date: '', activities: [] }
    setEditItinerary({ ...editItinerary, days: [...editItinerary.days, newDay] })
  }
  const removeDay = (idx: number) => {
    if (!editItinerary) return
    const days = editItinerary.days.slice()
    days.splice(idx, 1)
    setEditItinerary({ ...editItinerary, days })
  }
  const setDayDate = (idx: number, date: string) => {
    if (!editItinerary) return
    const days = editItinerary.days.slice()
    days[idx] = { ...days[idx], date }
    setEditItinerary({ ...editItinerary, days })
  }

  // 活动列表操作
  const addActivity = (dayIdx: number) => {
    if (!editItinerary) return
    const days = editItinerary.days.slice()
    const newAct: Activity = { time: '', title: '', type: 'other' }
    days[dayIdx] = { ...days[dayIdx], activities: [...(days[dayIdx].activities ?? []), newAct] }
    setEditItinerary({ ...editItinerary, days })
  }
  const removeActivity = (dayIdx: number, actIdx: number) => {
    if (!editItinerary) return
    const days = editItinerary.days.slice()
    const acts = (days[dayIdx].activities ?? []).slice()
    acts.splice(actIdx, 1)
    days[dayIdx] = { ...days[dayIdx], activities: acts }
    setEditItinerary({ ...editItinerary, days })
  }
  const setActivityField = (dayIdx: number, actIdx: number, field: keyof any, value: any) => {
    if (!editItinerary) return
    const days = editItinerary.days.slice()
    const acts = (days[dayIdx].activities ?? []).slice()
    acts[actIdx] = { ...acts[actIdx], [field]: value }
    days[dayIdx] = { ...days[dayIdx], activities: acts }
    setEditItinerary({ ...editItinerary, days })
  }

  const setActivityType = (dayIdx: number, actIdx: number, type: Activity['type']) => {
    setActivityField(dayIdx, actIdx, 'type', type)
  }

  const renderActivityFields = (a: Activity, di: number, ai: number) => {
    if (a.type === 'transport') {
      return (
        <div className="grid grid-transport">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>起点</label>
            <input value={(a as any).from ?? ''} onChange={e => setActivityField(di, ai, 'from', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>终点</label>
            <input value={(a as any).to ?? ''} onChange={e => setActivityField(di, ai, 'to', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>方式</label>
            <input value={(a as any).method ?? ''} onChange={e => setActivityField(di, ai, 'method', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>出发时间</label>
            <input value={(a as any).departTime ?? ''} onChange={e => setActivityField(di, ai, 'departTime', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>抵达时间</label>
            <input value={(a as any).arriveTime ?? ''} onChange={e => setActivityField(di, ai, 'arriveTime', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>时长</label>
            <input value={(a as any).duration ?? ''} onChange={e => setActivityField(di, ai, 'duration', e.target.value)} />
          </div>
          <div className="col-span-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>步骤（用逗号分隔）</label>
            <input
              value={Array.isArray((a as any).steps) ? (a as any).steps.join(', ') : ((a as any).steps ?? '')}
              onChange={e => setActivityField(di, ai, 'steps', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>抵达活动</label>
            <input type="checkbox" checked={!!(a as any).isArrival} onChange={e => setActivityField(di, ai, 'isArrival', e.target.checked)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>返程活动</label>
            <input type="checkbox" checked={!!(a as any).isDeparture} onChange={e => setActivityField(di, ai, 'isDeparture', e.target.checked)} />
          </div>
        </div>
      )
    }
    if (a.type === 'sightseeing') {
      return (
        <div className="grid grid-sight">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>名称</label>
            <input value={(a as any).name ?? ''} onChange={e => setActivityField(di, ai, 'name', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>地址</label>
            <input value={(a as any).address ?? ''} onChange={e => setActivityField(di, ai, 'address', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>纬度</label>
            <input type="number" value={(a as any).lat ?? ''} onChange={e => setActivityField(di, ai, 'lat', Number(e.target.value))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>经度</label>
            <input type="number" value={(a as any).lng ?? ''} onChange={e => setActivityField(di, ai, 'lng', Number(e.target.value))} />
          </div>
          <div className="col-span-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>简介</label>
            <input value={(a as any).intro ?? ''} onChange={e => setActivityField(di, ai, 'intro', e.target.value)} />
          </div>
        </div>
      )
    }
    if (a.type === 'food') {
      return (
        <div className="grid grid-food">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>餐厅</label>
            <input value={(a as any).name ?? ''} onChange={e => setActivityField(di, ai, 'name', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>地址</label>
            <input value={(a as any).address ?? ''} onChange={e => setActivityField(di, ai, 'address', e.target.value)} />
          </div>
          <div className="col-span-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>简介</label>
            <input value={(a as any).intro ?? ''} onChange={e => setActivityField(di, ai, 'intro', e.target.value)} />
          </div>
        </div>
      )
    }
    if (a.type === 'shopping') {
      return (
        <div className="grid grid-shop">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>名称</label>
            <input value={(a as any).name ?? ''} onChange={e => setActivityField(di, ai, 'name', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>地址</label>
            <input value={(a as any).address ?? ''} onChange={e => setActivityField(di, ai, 'address', e.target.value)} />
          </div>
          <div className="col-span-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>简介</label>
            <input value={(a as any).intro ?? ''} onChange={e => setActivityField(di, ai, 'intro', e.target.value)} />
          </div>
        </div>
      )
    }
    if (a.type === 'hotel') {
      return (
        <div className="grid grid-hotel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>酒店</label>
            <input value={(a as any).name ?? ''} onChange={e => setActivityField(di, ai, 'name', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>地址</label>
            <input value={(a as any).address ?? ''} onChange={e => setActivityField(di, ai, 'address', e.target.value)} />
          </div>
          {/* 删除价格字段，费用统一使用表格的“费用（costEstimate）”列 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>含早餐</label>
            <input type="checkbox" checked={!!(a as any).breakfastIncluded} onChange={e => setActivityField(di, ai, 'breakfastIncluded', e.target.checked)} />
          </div>
        </div>
      )
    }
    // other
    return (
      <div className="grid grid-other">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label>名称</label>
          <input value={(a as any).name ?? ''} onChange={e => setActivityField(di, ai, 'name', e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label>地址</label>
          <input value={(a as any).address ?? ''} onChange={e => setActivityField(di, ai, 'address', e.target.value)} />
        </div>
        <div className="col-span-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label>简介</label>
          <input value={(a as any).intro ?? ''} onChange={e => setActivityField(di, ai, 'intro', e.target.value)} />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h2>行程规划管理</h2>

      <div className="panel">
        <div className="panel-title">规划列表</div>
        {loading ? <div>加载中...</div> : (
          <table className="table">
            <thead>
              <tr><th>目的地</th><th>预算</th><th>创建时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {plans.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.destination}</td>
                  <td>¥{p.planned_budget}</td>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => startView(p)}>查看</button>
                    <button className="btn-secondary" onClick={() => startEdit(p)}>编辑</button>
                    <button className="btn-secondary" onClick={() => removePlan(p.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 查看详情（只读）——互斥渲染：仅当未编辑时显示 */}
      {viewId && viewPlan && !editingId ? (
        <div className="panel plan-view">
          <div className="panel-title">规划详情</div>
          <div className="plan-summary">
            <div className="summary-main">
              <div className="dest">
                <span className="badge badge-dest">{viewPlan.content?.destination || viewPlan.destination || '未命名目的地'}</span>
                {viewPlan.content?.origin ? <span className="badge badge-origin">出发地 {viewPlan.content.origin}</span> : null}
              </div>
              <div className="metrics">
                <span className="badge badge-budget">预算 ¥{viewPlan.planned_budget ?? 0}</span>
                <span className="badge badge-created">创建 {new Date(viewPlan.created_at).toLocaleString()}</span>
                {typeof viewPlan.content?.totalBudgetEstimate === 'number' ? (
                  <span className="badge badge-estimate">估算 ¥{viewPlan.content.totalBudgetEstimate}</span>
                ) : null}
              </div>
            </div>
            <div className="summary-actions">
              <button className="btn-secondary" onClick={() => { setViewId(null); setViewPlan(null) }}>关闭查看</button>
            </div>
          </div>

          {/* 每日时间线：按天分块 + 活动小卡片 */}
          <div className="day-blocks">
            {(Array.isArray(viewPlan.content?.days) ? viewPlan.content.days : []).map((day: any, di: number) => (
              <section key={di} className="day-block">
                <header className="day-header">
                  <div className="day-title">
                    <span className="day-index">Day {di + 1}</span>
                    <span className="day-date">{day.date}</span>
                  </div>
                </header>

                <div className="activities">
                  {(Array.isArray(day.activities) ? day.activities : []).map((a: Activity, ai: number) => (
                    <article key={ai} className={`activity-card activity-${a.type}`}>
                      <div className="activity-head">
                        <span className="time">{a.time || '--:--'}</span>
                        <span className="type">{typeLabel(a.type)}</span>
                        <span className="title">{a.title || (a as any).name || ''}</span>
                        <span className="cost">
                          {typeof (a as any).costEstimate === 'number'
                            ? <span className="badge badge-cost">¥{(a as any).costEstimate}</span>
                            : null}
                        </span>
                      </div>

                      {/* 详情按类型渲染 */}
                      {a.type === 'transport' ? (
                        <div className="detail transport">
                          <div className="kv"><strong>{(a as any).method || '出行'}</strong>：{(a as any).from} → {(a as any).to}</div>
                          {((a as any).departTime || (a as any).arriveTime) ? (
                            <div className="kv">出发 {(a as any).departTime || '--'} · 抵达 {(a as any).arriveTime || '--'}</div>
                          ) : null}
                          {(a as any).duration ? <div className="kv">时长：{(a as any).duration}</div> : null}
                          {Array.isArray((a as any).steps) && (a as any).steps.length > 0 ? (
                            <ul className="steps">{(a as any).steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                          ) : null}
                          <div className="flags">
                            {(a as any).isArrival ? <span className="badge">抵达</span> : null}
                            {(a as any).isDeparture ? <span className="badge">返程</span> : null}
                          </div>
                        </div>
                      ) : null}

                      {/* 在 transport 活动之后增加地图导航 */}
                      {a.type === 'transport' ? (
                        <div style={{ marginTop: 8 }}>
                          <MapView activity={a} height={500} />
                        </div>
                      ) : null}

                      {a.type === 'sightseeing' ? (
                        <div className="detail sightseeing">
                          {(a as any).name ? <div className="kv"><strong>{(a as any).name}</strong></div> : null}
                          {(a as any).address ? <div className="kv">地址：{(a as any).address}</div> : null}
                          {(a as any).intro ? <div className="intro">{(a as any).intro}</div> : null}
                          {/* {Array.isArray((a as any).imageUrls) && (a as any).imageUrls.length > 0 ? (
                            <div className="image-grid">
                              {(a as any).imageUrls.map((url: string, i: number) => (
                                <div key={i} className="image-thumb-wrap">
                                  <SafeImage className="image-thumb" src={url} alt={(a as any).name || a.title || `图片${i+1}`} />
                                  <a href={url} target="_blank" rel="noopener noreferrer">查看图片</a>
                                </div>
                              ))}
                            </div>
                          ) : null} */}
                        </div>
                      ) : null}

                      {a.type === 'food' ? (
                        <div className="detail food">
                          {(a as any).name ? <div className="kv"><strong>{(a as any).name}</strong></div> : null}
                          {(a as any).address ? <div className="kv">地址：{(a as any).address}</div> : null}
                          {(a as any).intro ? <div className="intro">{(a as any).intro}</div> : null}
                          {/* {(a as any).imageUrl ? (
                            <div className="image-grid">
                              <SafeImage className="image-thumb" src={(a as any).imageUrl} alt={(a as any).name || a.title} />
                              <a href={(a as any).imageUrl} target="_blank" rel="noopener noreferrer">查看图片</a>
                            </div>
                          ) : null} */}
                        </div>
                      ) : null}

                      {a.type === 'hotel' ? (
                        <div className="detail hotel">
                          {(a as any).name ? <div className="kv"><strong>{(a as any).name}</strong></div> : null}
                          {(a as any).address ? <div className="kv">地址：{(a as any).address}</div> : null}
                          {typeof (a as any).breakfastIncluded === 'boolean' ? (
                            <div className="kv">早餐：{(a as any).breakfastIncluded ? '含' : '不含'}</div>
                          ) : null}
                          {/* {(a as any).imageUrl ? (
                            <div className="image-grid">
                              <SafeImage className="image-thumb" src={(a as any).imageUrl} alt={(a as any).name || a.title} />
                              <a href={(a as any).imageUrl} target="_blank" rel="noopener noreferrer">查看图片</a>
                            </div>
                          ) : null} */}
                        </div>
                      ) : null}

                      {a.type === 'shopping' || a.type === 'other' ? (
                        <div className="detail other">
                          {(a as any).name ? <div className="kv"><strong>{(a as any).name}</strong></div> : null}
                          {(a as any).address ? <div className="kv">地址：{(a as any).address}</div> : null}
                          {(a as any).intro ? <div className="intro">{(a as any).intro}</div> : null}
                          {/* {(a as any).imageUrl ? (
                            <div className="image-grid">
                              <SafeImage className="image-thumb" src={(a as any).imageUrl} alt={(a as any).name || a.title} />
                              <a href={(a as any).imageUrl} target="_blank" rel="noopener noreferrer">查看图片</a>
                            </div>
                          ) : null} */}
                        </div>
                      ) : null}

                      {(a as any).notes ? <div className="notes">备注：{(a as any).notes}</div> : null}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* 提示列表（如有） */}
          {Array.isArray(viewPlan.content?.tips) && viewPlan.content.tips.length > 0 ? (
            <div className="panel tips">
              <div className="panel-subtitle">出行提示</div>
              <ul>{Array.isArray(viewPlan.content?.tips) ? viewPlan.content.tips.map((t: string, i: number) => <li key={i}>{t}</li>) : null}</ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 编辑面板——限制列宽并启用滚动容器 */}
      {editingId && editItinerary && !viewId ? (
        <div className="panel plan-edit">
          <div className="panel-title">编辑规划</div>

          <div className="edit-summary">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label>目的地</label>
                <input value={editItinerary.destination ?? ''} onChange={e => setDest(e.target.value)} />
              </div>
              <div>
                <label>出发地</label>
                <input value={editItinerary.origin ?? ''} onChange={e => setOrigin(e.target.value)} />
              </div>
              <div>
                <label>预算（¥）</label>
                <input type="number" value={editBudget} onChange={e => setEditBudget(Number(e.target.value))} />
              </div>
            </div>
            <div className="summary-actions">
              <button className="btn-secondary" onClick={addDay}>新增天</button>
              <button className="btn-primary" onClick={submitEdit}>保存修改</button>
              <button className="btn-secondary" onClick={() => { setEditingId(null); setEditItinerary(null) }}>关闭编辑</button>
            </div>
          </div>

          {/* 每日编辑：按 activities 时间线 */}
          {(editItinerary.days ?? []).map((day, di) => (
            <div key={di} className="day-edit">
              <div className="panel-subtitle">Day {di + 1}（{day.date || '未设日期'}）</div>
              <table className="table">
                {/* 新增：固定列宽，缩窄“时间”和“标题”列 */}
                <colgroup>
                  <col style={{ width: 80 }} />   {/* 时间 */}
                  <col style={{ width: 160 }} />  {/* 标题 */}
                  <col style={{ width: 110 }} />  {/* 类型 */}
                  <col />                          {/* 详情（自适应） */}
                  <col style={{ width: 160 }} />  {/* 备注 */}
                  <col style={{ width: 120 }} />  {/* 费用 */}
                  <col style={{ width: 100 }} />  {/* 操作 */}
                </colgroup>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>标题</th>
                    <th>类型</th>
                    <th>详情</th>
                    <th>备注</th>
                    <th>费用</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(day.activities ?? []).map((a, ai) => (
                    <tr key={ai}>
                      <td>
                        <input
                          value={a.time ?? ''}
                          onChange={e => setActivityField(di, ai, 'time', e.target.value)}
                          placeholder="HH:mm"
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <input
                          value={a.title ?? ''}
                          onChange={e => setActivityField(di, ai, 'title', e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <select
                          value={a.type ?? 'other'}
                          onChange={e => setActivityType(di, ai, e.target.value as Activity['type'])}
                          style={{ width: '100%' }}
                        >
                          <option value="transport">交通</option>
                          <option value="sightseeing">景点</option>
                          <option value="food">美食</option>
                          <option value="shopping">购物</option>
                          <option value="hotel">住宿</option>
                          <option value="other">其他</option>
                        </select>
                      </td>
                      <td>{renderActivityFields(a, di, ai)}</td>
                      <td>
                        <input
                          value={(a as any).notes ?? ''}
                          onChange={e => setActivityField(di, ai, 'notes', e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={(a as any).costEstimate ?? ''}
                          onChange={e => setActivityField(di, ai, 'costEstimate', Number(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <button className="btn-secondary" onClick={() => removeActivity(di, ai)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="day-actions">
                <button className="btn-secondary" onClick={() => addActivity(di)}>新增活动</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}