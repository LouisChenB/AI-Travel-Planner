import { useEffect, useState } from 'react'
import { signIn, signOut, signUp, getUserEmail } from '../api/supabase'

export default function Auth({ onUserChange }: { onUserChange: (email: string | null) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)

  useEffect(() => {
    console.log('Auth: 查询当前用户邮箱')
    getUserEmail().then(e => {
      setCurrentEmail(e)
      onUserChange(e)
    }).catch((err) => {
      console.error('Auth: 获取用户邮箱失败', err)
    })
  }, [])

  const doSignUp = async () => {
    console.log('Auth: 注册', email)
    try {
      await signUp(email, password)
      alert('注册成功，请查收验证邮件并登录。')
    } catch (err) {
      console.error('Auth: 注册失败', err)
      alert('注册失败，请稍后重试或检查配置')
    }
  }
  const doSignIn = async () => {
    console.log('Auth: 登录', email)
    try {
      await signIn(email, password)
      const e = await getUserEmail()
      setCurrentEmail(e)
      onUserChange(e)
    } catch (err) {
      console.error('Auth: 登录失败', err)
      alert('登录失败，请稍后重试或检查配置')
    }
  }
  const doSignOut = async () => {
    console.log('Auth: 退出登录')
    try {
      await signOut()
      setCurrentEmail(null)
      onUserChange(null)
    } catch (err) {
      console.error('Auth: 退出失败', err)
      alert('退出失败，请稍后重试')
    }
  }

  return (
    <div className="page">
      <h2>账号</h2>
      {currentEmail ? (
        <div>
          <div>已登录：{currentEmail}</div>
          <button onClick={doSignOut}>退出登录</button>
        </div>
      ) : (
        <div className="form">
          <label>邮箱</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />
          <label>密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <div className="row">
            <button onClick={doSignIn}>登录</button>
            <button onClick={doSignUp}>注册</button>
          </div>
        </div>
      )}
    </div>
  )
}