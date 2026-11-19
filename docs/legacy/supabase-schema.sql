create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  theme text not null,
  bible_reference text,
  sermon_type text,
  audience text,
  duration text,
  tone text,
  objective text not null,
  main_ideas text,
  instructions text,
  content jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.sermons add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists sermons_user_created_at_idx on public.sermons(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.sermons enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users manage own sermons" on public.sermons;
create policy "Users manage own sermons" on public.sermons for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
