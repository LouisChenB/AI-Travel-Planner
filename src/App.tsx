import { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Planner from './components/Planner'
import Expenses from './components/Expenses'
import Settings from './components/Settings'
import Auth from './components/Auth'
import PlanManager from './components/PlanManager'
import { getSettings } from './storage/settings'
import { createSupabaseClient, getUser } from './api/supabase'
import classNames from 'classnames'

export default function App() {
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const s = getSettings()
    if (s.supabaseUrl && s.supabaseAnonKey) {
      createSupabaseClient(s.supabaseUrl, s.supabaseAnonKey)
    }
    getUser().then(user => setUserEmail(user?.email ?? null))
    setReady(true)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="brand">AI 旅行规划师</div>
        <nav className="nav">
          <Link className={classNames('nav-link', { active: location.pathname === '/' })} to="/">智能行程规划</Link>
          <Link className={classNames('nav-link', { active: location.pathname === '/plans' })} to="/plans">行程管理</Link>
          <Link className={classNames('nav-link', { active: location.pathname === '/expenses' })} to="/expenses">费用管理</Link>
          <Link className={classNames('nav-link', { active: location.pathname === '/settings' })} to="/settings">设置</Link>
          <Link className={classNames('nav-link', { active: location.pathname === '/auth' })} to="/auth">{userEmail ? '账户' : '登录/注册'}</Link>
        </nav>
      </header>
      <main className="main">
        {ready ? (
          <Routes>
            <Route path="/" element={<Planner />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/auth" element={<Auth onUserChange={(email) => setUserEmail(email)} />} />
            <Route path="/plans" element={<PlanManager />} />
          </Routes>
        ) : (
          <div className="page">加载中...</div>
        )}
      </main>
      <footer className="footer">
        <div>请在“设置”页填写各类 API Key。</div>
      </footer>
    </div>
  )
}
