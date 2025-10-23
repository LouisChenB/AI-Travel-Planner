-- 在 Supabase SQL Editor 中执行以下脚本创建表并配置 RLS

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  destination text,
  planned_budget numeric,
  content jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid,
  date date not null,
  category text not null,
  description text not null,
  amount numeric not null,
  currency text default 'CNY',
  created_at timestamp with time zone default now()
);

alter table public.plans enable row level security;
alter table public.expenses enable row level security;

create policy "plans are viewable by owner" on public.plans
  for select using (auth.uid() = user_id);

create policy "plans are insertable by owner" on public.plans
  for insert with check (auth.uid() = user_id);

create policy "expenses are viewable by owner" on public.expenses
  for select using (auth.uid() = user_id);

create policy "expenses are insertable by owner" on public.expenses
  for insert with check (auth.uid() = user_id);