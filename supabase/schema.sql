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

-- 已有的 select/insert 策略
create policy "plans are viewable by owner" on public.plans
  for select using (auth.uid() = user_id);

create policy "plans are insertable by owner" on public.plans
  for insert with check (auth.uid() = user_id);

create policy "expenses are viewable by owner" on public.expenses
  for select using (auth.uid() = user_id);

create policy "expenses are insertable by owner" on public.expenses
  for insert with check (auth.uid() = user_id);

-- 新增：允许所有者更新与删除 plans
create policy "plans are updatable by owner" on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plans are deletable by owner" on public.plans
  for delete using (auth.uid() = user_id);

-- 新增：允许所有者更新与删除 expenses（若需要在管理页支持编辑/删除开销）
create policy "expenses are updatable by owner" on public.expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses are deletable by owner" on public.expenses
  for delete using (auth.uid() = user_id);