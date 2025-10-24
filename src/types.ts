export type TripPreferences = {
  destination: string
  startDate: string
  endDate: string
  budget: number
  people: number
  interests: string[]
  withKids?: boolean
  origin?: string
}

export type ActivityBase = {
  time: string
  title: string
  notes?: string
  costEstimate?: number
}

// 交通活动：用于首日抵达、末日返程，以及当天景点/餐厅之间的移动
export type TransportActivity = ActivityBase & {
  type: 'transport'
  from: string
  to: string
  method: string
  // 新增：起终点经纬度（优先用于导航）
  fromLat?: number
  fromLng?: number
  toLat?: number
  toLng?: number
  steps?: string[]
  duration?: string
  departTime?: string
  arriveTime?: string
  isArrival?: boolean
  isDeparture?: boolean
}

// 景点
export type SightseeingActivity = ActivityBase & {
  type: 'sightseeing'
  name: string
  address?: string
  lat?: number
  lng?: number
  intro?: string
  imageUrls?: string[]
}

// 餐饮
export type FoodActivity = ActivityBase & {
  type: 'food'
  name: string
  address?: string
  lat?: number
  lng?: number
  intro?: string
  imageUrl?: string
}

// 购物
export type ShoppingActivity = ActivityBase & {
  type: 'shopping'
  name: string
  address?: string
  lat?: number
  lng?: number
  intro?: string
  imageUrl?: string
}

// 酒店
export type HotelActivity = ActivityBase & {
  type: 'hotel'
  name: string
  address?: string
  lat?: number
  lng?: number
  breakfastIncluded?: boolean
  imageUrl?: string
}

// 其他
export type OtherActivity = ActivityBase & {
  type: 'other'
  name?: string
  address?: string
  lat?: number
  lng?: number
  intro?: string
  imageUrl?: string
}

export type Activity =
  | TransportActivity
  | SightseeingActivity
  | FoodActivity
  | ShoppingActivity
  | HotelActivity
  | OtherActivity

export type DayPlan = {
  date: string
  activities: Activity[] // 按时间顺序排列，包含餐饮/景点/酒店/交通等
}

export type Itinerary = {
  destination: string
  days: DayPlan[]
  totalBudgetEstimate?: number
  tips?: string[]
  transportAdvice?: string
  origin?: string
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