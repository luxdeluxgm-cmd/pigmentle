create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.puzzles (
  id bigint generated always as identity primary key,
  game text not null check (game in ('subtra', 'idiomatic')),
  puzzle_date date not null,
  puzzle_number integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint puzzles_one_per_game_per_day unique (game, puzzle_date),
  constraint puzzles_unique_number_per_game unique (game, puzzle_number)
);

create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('subtra', 'idiomatic')),
  puzzle_date date not null,
  guess_number smallint not null check (guess_number between 1 and 5),
  guess_data jsonb not null,
  feedback jsonb not null,
  created_at timestamptz not null default now(),
  constraint attempts_unique_guess_slot unique (user_id, game, puzzle_date, guess_number)
);

create table if not exists public.game_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('subtra', 'idiomatic')),
  puzzle_date date not null,
  won boolean not null,
  guesses_used smallint not null check (guesses_used between 1 and 5),
  completed_at timestamptz not null default now(),
  constraint game_history_one_result_per_day unique (user_id, game, puzzle_date)
);

create table if not exists public.streaks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null check (game in ('subtra', 'idiomatic')),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_played_date date,
  last_won_date date,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);

alter table public.profiles enable row level security;
alter table public.puzzles enable row level security;
alter table public.attempts enable row level security;
alter table public.game_history enable row level security;
alter table public.streaks enable row level security;

drop policy if exists "Players can read own profile" on public.profiles;
create policy "Players can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Players can update own profile" on public.profiles;
create policy "Players can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Players can read own attempts" on public.attempts;
create policy "Players can read own attempts"
  on public.attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can read own game history" on public.game_history;
create policy "Players can read own game history"
  on public.game_history
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can read own streaks" on public.streaks;
create policy "Players can read own streaks"
  on public.streaks
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_anonymous, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Guest'),
    coalesce(new.is_anonymous, true),
    now()
  )
  on conflict (id) do update
  set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    is_anonymous = coalesce(new.is_anonymous, false),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_or_updated on auth.users;
create trigger on_auth_user_created_or_updated
  after insert or update on auth.users
  for each row execute procedure public.handle_auth_user_sync();

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
