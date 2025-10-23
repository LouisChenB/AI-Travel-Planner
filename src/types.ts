export type TripPreferences = {
  destination: string
  startDate: string
  endDate: string
  budget: number
  people: number
  interests: string[]
  withKids?: boolean
}

export type Activity = {
  time: string
  title: string
  type: 'sightseeing' | 'food' | 'shopping' | 'transport' | 'hotel' | 'other'
  address?: string
  lat?: number
  lng?: number
  notes?: string
  costEstimate?: number
}

export type DayPlan = {
  date: string
  activities: Activity[]
}

export type Itinerary = {
  destination: string
  days: DayPlan[]
  totalBudgetEstimate?: number
  hotelRecommendations?: { name: string; address?: string; lat?: number; lng?: number; price?: number }[]
  restaurantRecommendations?: { name: string; address?: string; lat?: number; lng?: number; price?: number }[]
  transportAdvice?: string
  tips?: string[]
}

export type Expense = {
  id?: string
  user_id?: string
  plan_id?: string
  date: string
  category: string
  description: string
  amount: number
  currency?: string
}

export type BudgetAnalysis = {
  total: number
  byCategory: Record<string, number>
  overBudget: boolean
  suggestions: string[]
}

export type Settings = {
  llmBaseUrl?: string
  llmApiKey?: string
  llmModel?: string
  amapKey?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
  // 新增：科大讯飞语音识别所需
  xfyAppId?: string
  xfyApiKey?: string
  xfyApiSecret?: string
}