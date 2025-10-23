import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import type { Expense, Itinerary } from '../types'

let client: SupabaseClient | null = null

export function createSupabaseClient(url: string, anonKey: string) {
  client = createClient(url, anonKey)
  return client
}

export function getClient(): SupabaseClient {
  if (!client) throw new Error('Supabase 未初始化，请在设置页填写并保存。')
  return client
}

export async function getUser(): Promise<User | null> {
  if (!client) return null
  const { data } = await client.auth.getUser()
  return data.user
}

export async function getUserEmail(): Promise<string | null> {
  const c = getClient()
  const { data } = await c.auth.getUser()
  return data.user?.email ?? null
}

export async function signUp(email: string, password: string) {
  const c = getClient()
  const { error } = await c.auth.signUp({ email, password })
  if (error) throw error
}

export async function signIn(email: string, password: string) {
  const c = getClient()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  const c = getClient()
  const { error } = await c.auth.signOut()
  if (error) throw error
}

export async function savePlan(itinerary: Itinerary, plannedBudget: number) {
  const c = getClient()
  const { data: userRes } = await c.auth.getUser()
  const userId = userRes.user?.id
  const { data, error } = await c
    .from('plans')
    .insert({
      user_id: userId,
      destination: itinerary.destination,
      content: itinerary,
      planned_budget: plannedBudget,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listPlans() {
  const c = getClient()
  const { data: userRes } = await c.auth.getUser()
  const userId = userRes.user?.id
  const { data, error } = await c
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function saveExpense(expense: Expense, planId?: string) {
  const c = getClient()
  const { data: userRes } = await c.auth.getUser()
  const userId = userRes.user?.id
  const { data, error } = await c
    .from('expenses')
    .insert({
      user_id: userId,
      plan_id: planId ?? null,
      date: expense.date,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency ?? 'CNY',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listExpenses(planId?: string) {
  const c = getClient()
  const { data: userRes } = await c.auth.getUser()
  const userId = userRes.user?.id
  let query = c.from('expenses').select('*').eq('user_id', userId)
  if (planId) query = query.eq('plan_id', planId)
  const { data, error } = await query.order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}