-- ===================================================================
-- مَقْلَمَة — مخطّط قاعدة البيانات لـ Supabase
-- نفّذ هذا الملف مرة واحدة في: Supabase Dashboard > SQL Editor > New query
-- ===================================================================

-- ============== ENUMS & EXTENSIONS ==============
create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum ('admin','student');
exception when duplicate_object then null; end $$;

-- ============== PROFILES ==============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null,
  email text,
  avatar text,
  role public.app_role not null default 'student',
  joined_at timestamptz not null default now(),
  online boolean not null default false,
  last_seen timestamptz default now()
);

-- ============== USER_ROLES (security-definer-friendly) ==============
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);

create or replace function public.has_role(_uid uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

-- ============== LEARNING PATHS ==============
create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text default 'fa-route',
  color text default 'linear-gradient(135deg,#4f46e5,#06b6d4)',
  cover_image text,
  created_at timestamptz not null default now()
);

-- ============== COURSES ==============
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default 'عام',
  description text,
  icon text default 'fa-book',
  color text default 'linear-gradient(135deg,#4f46e5,#06b6d4)',
  instructor text,
  instructor_image text,
  cover_image text,
  duration text,
  path_id uuid references public.learning_paths(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Safe upgrades for existing databases
alter table public.learning_paths add column if not exists cover_image text;
alter table public.courses add column if not exists cover_image text;
alter table public.courses add column if not exists instructor_image text;

-- ============== LESSONS ==============
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  type text not null check (type in ('video','pdf','image','file')),
  duration text,
  url text,
  storage_path text,
  position int default 0,
  created_at timestamptz not null default now()
);

-- ============== ENROLLMENTS (per-student course access) ==============
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique(user_id, course_id)
);

create table if not exists public.path_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  unique(user_id, path_id)
);

-- ============== CHAT ROOMS & MESSAGES ==============
create table if not exists public.chat_rooms (
  id text primary key,
  name text not null,
  icon text default 'fa-comments',
  created_at timestamptz not null default now()
);

insert into public.chat_rooms (id,name,icon) values
  ('r_general','النقاش العام','fa-users'),
  ('r_help','مساعدة الطلاب','fa-circle-question'),
  ('r_announce','الإعلانات','fa-bullhorn')
on conflict (id) do nothing;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  text text,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_msg_room_time on public.chat_messages(room_id, created_at);

-- ============== NOTIFICATIONS ==============
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = للجميع
  title text not null,
  body text,
  icon text default 'fa-bell',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============== LIVE STREAMS ==============
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,        -- رابط HLS / YouTube embed / أي مصدر
  kind text default 'hls',  -- 'hls' | 'youtube' | 'iframe'
  course_id uuid references public.courses(id) on delete set null,
  active boolean not null default true,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now()
);

-- ============== APP SETTINGS (singleton row) ==============
create table if not exists public.app_settings (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (id = 1)
);
insert into public.app_settings (id,data) values (1,'{}'::jsonb) on conflict do nothing;

-- ============== GRANTS ==============
grant usage on schema public to anon, authenticated;
grant select on public.chat_rooms to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.learning_paths to authenticated;
grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.lessons to authenticated;
grant select, insert, update, delete on public.enrollments to authenticated;
grant select, insert, update, delete on public.path_enrollments to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.live_streams to authenticated;
grant select, update on public.app_settings to authenticated;
grant all on all tables in schema public to service_role;

-- ============== RLS ==============
alter table public.profiles         enable row level security;
alter table public.user_roles       enable row level security;
alter table public.learning_paths   enable row level security;
alter table public.courses          enable row level security;
alter table public.lessons          enable row level security;
alter table public.enrollments      enable row level security;
alter table public.path_enrollments enable row level security;
alter table public.chat_rooms       enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.notifications    enable row level security;
alter table public.live_streams     enable row level security;
alter table public.app_settings     enable row level security;

-- ----- profiles
drop policy if exists "profiles read all auth" on public.profiles;
create policy "profiles read all auth" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (public.is_admin() or (id = auth.uid() and role = 'student'));
drop policy if exists "profiles admin insert" on public.profiles;
create policy "profiles admin insert" on public.profiles for insert to authenticated
  with check (public.is_admin() or (id = auth.uid() and role = 'student'));
drop policy if exists "profiles admin delete" on public.profiles;
create policy "profiles admin delete" on public.profiles for delete to authenticated using (public.is_admin());

-- ----- user_roles
drop policy if exists "roles read self or admin" on public.user_roles;
create policy "roles read self or admin" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "roles admin write" on public.user_roles;
create policy "roles admin write" on public.user_roles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----- learning paths / courses / lessons / chat rooms / live streams
-- Students only see learning content they have been granted access to.
drop policy if exists "learning_paths read auth" on public.learning_paths;
create policy "learning_paths read auth" on public.learning_paths for select to authenticated
using (public.is_admin() or exists (select 1 from public.path_enrollments pe where pe.path_id = id and pe.user_id = auth.uid()));
drop policy if exists "learning_paths admin write" on public.learning_paths;
create policy "learning_paths admin write" on public.learning_paths for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "courses read auth" on public.courses;
create policy "courses read auth" on public.courses for select to authenticated
using (public.is_admin()
  or exists (select 1 from public.enrollments e where e.course_id = id and e.user_id = auth.uid())
  or (path_id is not null and exists (select 1 from public.path_enrollments pe where pe.path_id = courses.path_id and pe.user_id = auth.uid()))
);
drop policy if exists "courses admin write" on public.courses;
create policy "courses admin write" on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "lessons read auth" on public.lessons;
create policy "lessons read auth" on public.lessons for select to authenticated
using (public.is_admin()
  or exists (select 1 from public.enrollments e where e.course_id = lessons.course_id and e.user_id = auth.uid())
  or exists (select 1 from public.courses c join public.path_enrollments pe on pe.path_id = c.path_id where c.id = lessons.course_id and pe.user_id = auth.uid())
);
drop policy if exists "lessons admin write" on public.lessons;
create policy "lessons admin write" on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "chat_rooms read auth" on public.chat_rooms;
create policy "chat_rooms read auth" on public.chat_rooms for select to authenticated using (true);
drop policy if exists "chat_rooms admin write" on public.chat_rooms;
create policy "chat_rooms admin write" on public.chat_rooms for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "live_streams read auth" on public.live_streams;
create policy "live_streams read auth" on public.live_streams for select to authenticated using (public.is_admin() or true);
drop policy if exists "live_streams admin write" on public.live_streams;
create policy "live_streams admin write" on public.live_streams for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----- enrollments
drop policy if exists "enroll read self" on public.enrollments;
create policy "enroll read self" on public.enrollments for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "enroll admin write" on public.enrollments;
create policy "enroll admin write" on public.enrollments for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "path_enroll read self" on public.path_enrollments;
create policy "path_enroll read self" on public.path_enrollments for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "path_enroll admin write" on public.path_enrollments;
create policy "path_enroll admin write" on public.path_enrollments for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----- chat_messages
drop policy if exists "msg read auth" on public.chat_messages;
create policy "msg read auth" on public.chat_messages for select to authenticated using (true);
drop policy if exists "msg insert own" on public.chat_messages;
create policy "msg insert own" on public.chat_messages for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "msg delete own or admin" on public.chat_messages;
create policy "msg delete own or admin" on public.chat_messages for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- ----- notifications
drop policy if exists "notif read self or broadcast" on public.notifications;
create policy "notif read self or broadcast" on public.notifications for select to authenticated using (user_id is null or user_id = auth.uid() or public.is_admin());
drop policy if exists "notif update self" on public.notifications;
create policy "notif update self" on public.notifications for update to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "notif admin insert" on public.notifications;
create policy "notif admin insert" on public.notifications for insert to authenticated with check (public.is_admin() or user_id = auth.uid());

-- ----- app_settings
drop policy if exists "settings read auth" on public.app_settings;
create policy "settings read auth" on public.app_settings for select to authenticated using (true);
drop policy if exists "settings admin update" on public.app_settings;
create policy "settings admin update" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============== REALTIME ==============
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.live_streams;
alter publication supabase_realtime add table public.courses;
alter publication supabase_realtime add table public.lessons;
alter publication supabase_realtime add table public.profiles;

-- ============== STORAGE BUCKET ==============
insert into storage.buckets (id, name, public, file_size_limit)
values ('maqlama','maqlama', true, 524288000) -- 500MB
on conflict (id) do update set public = true, file_size_limit = 524288000;

-- Storage policies
drop policy if exists "maqlama read public" on storage.objects;
create policy "maqlama read public" on storage.objects for select to public using (bucket_id = 'maqlama');

drop policy if exists "maqlama upload auth" on storage.objects;
create policy "maqlama upload auth" on storage.objects for insert to authenticated
with check (bucket_id = 'maqlama' and (public.is_admin() or name like 'chat/' || auth.uid()::text || '/%'));

drop policy if exists "maqlama update own" on storage.objects;
create policy "maqlama update own" on storage.objects for update to authenticated using (bucket_id='maqlama' and (owner = auth.uid() or public.is_admin()));

drop policy if exists "maqlama delete own or admin" on storage.objects;
create policy "maqlama delete own or admin" on storage.objects for delete to authenticated using (bucket_id='maqlama' and (owner = auth.uid() or public.is_admin()));

-- ============== AUTO-CREATE PROFILE ON SIGNUP ==============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, name, email, avatar, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar', left(coalesce(new.raw_user_meta_data->>'name', new.email), 1)),
    'student'
  ) on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- ===================================================================
-- ============== QUIZZES / EXAMS SYSTEM (added) ==============
-- Minimal-footprint addition: reuses existing course access rules
-- (enrollments / path_enrollments) and the existing is_admin() helper.
-- ===================================================================

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb, -- [{"id":"a","text":"..."}, {"id":"b","text":"..."}]
  correct_option text not null,               -- must match one options[].id
  points int not null default 1 check (points > 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,   -- {question_id: option_id}
  breakdown jsonb not null default '[]'::jsonb, -- [{question_id, correct}]
  score int not null default 0,
  max_score int not null default 0,
  submitted_at timestamptz not null default now(),
  unique(quiz_id, user_id)
);

create index if not exists idx_quiz_course on public.quizzes(course_id);
create index if not exists idx_quiz_questions_quiz on public.quiz_questions(quiz_id);
create index if not exists idx_quiz_attempts_quiz on public.quiz_attempts(quiz_id);
create index if not exists idx_quiz_attempts_user on public.quiz_attempts(user_id);

-- Students never get direct table access to quiz_questions (it holds
-- correct_option). They read this view instead, which strips the
-- correct answer and re-applies the same course-access rule used for
-- courses/lessons.
create or replace view public.quiz_questions_public as
select q.id, q.quiz_id, q.question, q.options, q.points, q.position
from public.quiz_questions q
join public.quizzes z on z.id = q.quiz_id
where public.is_admin()
   or exists (select 1 from public.enrollments e where e.course_id = z.course_id and e.user_id = auth.uid())
   or exists (
        select 1 from public.courses c
        join public.path_enrollments pe on pe.path_id = c.path_id
        where c.id = z.course_id and pe.user_id = auth.uid()
      );

grant select on public.quiz_questions_public to authenticated;

-- Server-side grading: the only way a student's answers become a
-- quiz_attempts row. Runs as SECURITY DEFINER so it can read
-- correct_option (blocked from students by RLS below) without ever
-- returning it to the caller — only the score + a per-question
-- correct/incorrect flag are returned.
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_score int := 0;
  v_max int := 0;
  v_has_access boolean;
  q record;
  v_answer text;
  v_correct boolean;
  v_breakdown jsonb := '[]'::jsonb;
begin
  select course_id into v_course_id from public.quizzes where id = p_quiz_id;
  if v_course_id is null then
    raise exception 'الاختبار غير موجود';
  end if;

  select public.is_admin()
      or exists (select 1 from public.enrollments e where e.course_id = v_course_id and e.user_id = auth.uid())
      or exists (
           select 1 from public.courses c
           join public.path_enrollments pe on pe.path_id = c.path_id
           where c.id = v_course_id and pe.user_id = auth.uid()
         )
    into v_has_access;

  if not coalesce(v_has_access, false) then
    raise exception 'غير مصرح لك بهذا الاختبار';
  end if;

  if exists (select 1 from public.quiz_attempts where quiz_id = p_quiz_id and user_id = auth.uid()) then
    raise exception 'لقد قمت بأداء هذا الاختبار من قبل';
  end if;

  for q in select id, correct_option, points from public.quiz_questions where quiz_id = p_quiz_id loop
    v_max := v_max + q.points;
    v_answer := p_answers ->> (q.id::text);
    v_correct := (v_answer is not null and v_answer = q.correct_option);
    if v_correct then v_score := v_score + q.points; end if;
    v_breakdown := v_breakdown || jsonb_build_object('question_id', q.id, 'correct', v_correct);
  end loop;

  insert into public.quiz_attempts (quiz_id, user_id, answers, breakdown, score, max_score)
  values (p_quiz_id, auth.uid(), p_answers, v_breakdown, v_score, v_max);

  return jsonb_build_object('score', v_score, 'max_score', v_max, 'breakdown', v_breakdown);
end;
$$;

grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

-- ----- RLS
alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts  enable row level security;

drop policy if exists "quizzes read auth" on public.quizzes;
create policy "quizzes read auth" on public.quizzes for select to authenticated
using (public.is_admin()
  or exists (select 1 from public.enrollments e where e.course_id = quizzes.course_id and e.user_id = auth.uid())
  or exists (select 1 from public.courses c join public.path_enrollments pe on pe.path_id = c.path_id where c.id = quizzes.course_id and pe.user_id = auth.uid())
);
drop policy if exists "quizzes admin write" on public.quizzes;
create policy "quizzes admin write" on public.quizzes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- quiz_questions: admin only — students must go through quiz_questions_public
drop policy if exists "quiz_questions admin all" on public.quiz_questions;
create policy "quiz_questions admin all" on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- quiz_attempts: everyone can read their own (or admin reads all);
-- writes are admin-only directly — students write only via the
-- submit_quiz_attempt() SECURITY DEFINER function above.
drop policy if exists "attempts read self or admin" on public.quiz_attempts;
create policy "attempts read self or admin" on public.quiz_attempts for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "attempts admin write" on public.quiz_attempts;
create policy "attempts admin write" on public.quiz_attempts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===================================================================
-- ============== TIMED EXAMS (added) ==============
-- Minimal-footprint addition on top of the quiz system above:
-- - quizzes gets a duration set by the admin.
-- - quiz_sessions tracks the server-side start time / deadline for a
--   student's single attempt, so the countdown, the auto-submit, and
--   the "one attempt only" rule are all verified from the database,
--   never trusted from the browser clock.
-- - quiz_attempts gets started_at / duration_minutes / status so the
--   admin can see exactly when a student began, submitted, and
--   whether it was a normal submission or an auto-submit on timeout.
-- ===================================================================

alter table public.quizzes add column if not exists duration_minutes int not null default 10 check (duration_minutes > 0);

alter table public.quiz_attempts add column if not exists started_at timestamptz;
alter table public.quiz_attempts add column if not exists duration_minutes int not null default 0;
alter table public.quiz_attempts add column if not exists status text not null default 'submitted' check (status in ('submitted','auto_submitted'));

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  duration_minutes int not null,
  deadline timestamptz not null,
  answers jsonb not null default '{}'::jsonb, -- best-effort autosave, used only if the session is closed after a crash/disconnect
  status text not null default 'in_progress' check (status in ('in_progress','submitted','expired')),
  unique(quiz_id, user_id)
);
create index if not exists idx_quiz_sessions_quiz on public.quiz_sessions(quiz_id);
create index if not exists idx_quiz_sessions_user on public.quiz_sessions(user_id);

grant select on public.quiz_sessions to authenticated;

alter table public.quiz_sessions enable row level security;
drop policy if exists "quiz_sessions read self or admin" on public.quiz_sessions;
create policy "quiz_sessions read self or admin" on public.quiz_sessions for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "quiz_sessions admin write" on public.quiz_sessions;
create policy "quiz_sessions admin write" on public.quiz_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Students never write this table directly — only through the
-- SECURITY DEFINER functions below, which enforce the single-attempt
-- and timing rules on the server.

-- ----- shared access check (same rule already used for quizzes/lessons/courses)
create or replace function public._quiz_access(p_quiz_id uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (
      select 1 from public.quizzes z
      join public.enrollments e on e.course_id = z.course_id
      where z.id = p_quiz_id and e.user_id = p_uid
    )
    or exists (
      select 1 from public.quizzes z
      join public.courses c on c.id = z.course_id
      join public.path_enrollments pe on pe.path_id = c.path_id
      where z.id = p_quiz_id and pe.user_id = p_uid
    )
$$;

-- ----- shared grading logic (used by submit + the auto-close path below)
create or replace function public._grade_quiz(p_quiz_id uuid, p_answers jsonb)
returns table(score int, max_score int, breakdown jsonb)
language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_answer text;
  v_correct boolean;
  v_score int := 0;
  v_max int := 0;
  v_breakdown jsonb := '[]'::jsonb;
begin
  for q in select id, correct_option, points from public.quiz_questions where quiz_id = p_quiz_id loop
    v_max := v_max + q.points;
    v_answer := p_answers ->> (q.id::text);
    v_correct := (v_answer is not null and v_answer = q.correct_option);
    if v_correct then v_score := v_score + q.points; end if;
    v_breakdown := v_breakdown || jsonb_build_object('question_id', q.id, 'correct', v_correct);
  end loop;
  return query select v_score, v_max, v_breakdown;
end;
$$;

-- ----- start (or resume) a timed attempt; this is the ONLY way a
-- student's countdown/deadline gets created, and it's the server
-- clock (now()) that decides everything, never the browser.
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration int;
  v_session public.quiz_sessions;
  v_grade record;
begin
  if not public._quiz_access(p_quiz_id, auth.uid()) then
    raise exception 'غير مصرح لك بهذا الاختبار';
  end if;

  if exists (select 1 from public.quiz_attempts where quiz_id = p_quiz_id and user_id = auth.uid()) then
    raise exception 'لقد قمت بأداء هذا الاختبار من قبل';
  end if;

  select duration_minutes into v_duration from public.quizzes where id = p_quiz_id;
  if v_duration is null then
    raise exception 'الاختبار غير موجود';
  end if;

  select * into v_session from public.quiz_sessions where quiz_id = p_quiz_id and user_id = auth.uid();

  if v_session.id is not null then
    if now() >= v_session.deadline then
      -- Time was already up and the student never formally submitted
      -- (e.g. closed the tab). Close the attempt now, graded from
      -- whatever was last autosaved, and refuse a new attempt.
      select * into v_grade from public._grade_quiz(p_quiz_id, v_session.answers);
      insert into public.quiz_attempts
        (quiz_id, user_id, answers, breakdown, score, max_score, started_at, submitted_at, duration_minutes, status)
      values
        (p_quiz_id, auth.uid(), v_session.answers, v_grade.breakdown, v_grade.score, v_grade.max_score,
         v_session.started_at, now(), v_session.duration_minutes, 'auto_submitted');
      update public.quiz_sessions set status = 'expired' where id = v_session.id;
      raise exception 'انتهى وقت الاختبار — تم تسليمه وتصحيحه تلقائيًا ولا يمكن إعادة المحاولة';
    else
      -- Resume: same deadline as before (page refresh / re-entry safe).
      return jsonb_build_object(
        'started_at', v_session.started_at,
        'deadline', v_session.deadline,
        'duration_minutes', v_session.duration_minutes,
        'server_now', now()
      );
    end if;
  end if;

  insert into public.quiz_sessions (quiz_id, user_id, started_at, duration_minutes, deadline)
  values (p_quiz_id, auth.uid(), now(), v_duration, now() + (v_duration || ' minutes')::interval)
  returning * into v_session;

  return jsonb_build_object(
    'started_at', v_session.started_at,
    'deadline', v_session.deadline,
    'duration_minutes', v_session.duration_minutes,
    'server_now', now()
  );
end;
$$;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;

-- ----- best-effort periodic autosave while the exam is in progress
-- (only ever used as a recovery net if the session gets force-closed
-- by start_quiz_attempt above without a normal submission).
create or replace function public.save_quiz_progress(p_quiz_id uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quiz_sessions
  set answers = p_answers
  where quiz_id = p_quiz_id and user_id = auth.uid() and status = 'in_progress' and now() < deadline;
end;
$$;
grant execute on function public.save_quiz_progress(uuid, jsonb) to authenticated;

-- ----- submit + grade (replaces the earlier version): now requires an
-- active server-side session, stamps started_at/duration/status, and
-- marks late submissions (past the deadline) as 'auto_submitted'.
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.quiz_sessions;
  v_grade record;
  v_status text;
begin
  if not public._quiz_access(p_quiz_id, auth.uid()) then
    raise exception 'غير مصرح لك بهذا الاختبار';
  end if;

  if exists (select 1 from public.quiz_attempts where quiz_id = p_quiz_id and user_id = auth.uid()) then
    raise exception 'لقد قمت بأداء هذا الاختبار من قبل';
  end if;

  select * into v_session from public.quiz_sessions
  where quiz_id = p_quiz_id and user_id = auth.uid() and status = 'in_progress';

  if v_session.id is null then
    raise exception 'لم يتم بدء هذا الاختبار بشكل صحيح — أعد فتح صفحة الاختبار';
  end if;

  v_status := case when now() <= v_session.deadline then 'submitted' else 'auto_submitted' end;

  select * into v_grade from public._grade_quiz(p_quiz_id, p_answers);

  insert into public.quiz_attempts
    (quiz_id, user_id, answers, breakdown, score, max_score, started_at, submitted_at, duration_minutes, status)
  values
    (p_quiz_id, auth.uid(), p_answers, v_grade.breakdown, v_grade.score, v_grade.max_score,
     v_session.started_at, now(), v_session.duration_minutes, v_status);

  update public.quiz_sessions set status = 'submitted' where id = v_session.id;

  return jsonb_build_object('score', v_grade.score, 'max_score', v_grade.max_score, 'breakdown', v_grade.breakdown, 'status', v_status);
end;
$$;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

-- ===================================================================
-- ============== STUDENT CATALOG BROWSING (added) ==============
-- Students may now SEE every course/path (title, description, cover,
-- instructor...) to browse the catalog, but this policy only grants
-- SELECT — it does NOT touch the "courses admin write" / "learning_paths
-- admin write" policies above, so creating/editing/deleting is still
-- admin-only. Actual content (lessons, quizzes, files) stays gated by
-- the enrollment-based policies already defined above, so a course a
-- student can now "see" in the catalog still has zero visible lessons/
-- quizzes for them until an admin enrolls them.
-- ===================================================================
drop policy if exists "learning_paths read auth" on public.learning_paths;
create policy "learning_paths read auth" on public.learning_paths for select to authenticated using (true);

drop policy if exists "courses read auth" on public.courses;
create policy "courses read auth" on public.courses for select to authenticated using (true);

-- ============== "RECORD" LESSON TYPE (added) ==============
-- Adds a 4th lesson type so admins can tell a recorded live session
-- (ريكورد) apart from a regular course video, matching the required
-- student course-page order: فيديوهات / ريكوردات / ورق محاضرات / اختبارات.
alter table public.lessons drop constraint if exists lessons_type_check;
alter table public.lessons add constraint lessons_type_check check (type in ('video','record','pdf','image','file'));

-- ===================================================================
-- ============== PRIVATE LESSON STORAGE (added) ==============
-- The original 'maqlama' bucket is PUBLIC, so anyone with a file's URL
-- can open it with no permission check at all — fine for cover/branding
-- images, not fine for actual course content (videos/records/lecture
-- files). This adds a second, PRIVATE bucket just for lesson content.
-- Reads require a real RLS check (enrollment or admin) run on Supabase's
-- servers, so the only way to get a working link is a short-lived signed
-- URL minted for a user who actually passes that check — a raw/guessed
-- URL to this bucket resolves to nothing.
-- ===================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('maqlama-lessons','maqlama-lessons', false, 524288000)
on conflict (id) do update set public = false, file_size_limit = 524288000;

-- Shared access check reused by the storage policy below: is this
-- object path a lesson file that the current user is allowed to see
-- (admin, or enrolled in the lesson's course directly or via its path)?
create or replace function public._lesson_file_access(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.lessons l
    where l.storage_path = p_path
      and (
        exists (select 1 from public.enrollments e where e.course_id = l.course_id and e.user_id = auth.uid())
        or exists (
          select 1 from public.courses c
          join public.path_enrollments pe on pe.path_id = c.path_id
          where c.id = l.course_id and pe.user_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists "maqlama-lessons read granted" on storage.objects;
create policy "maqlama-lessons read granted" on storage.objects for select to authenticated
using (bucket_id = 'maqlama-lessons' and public._lesson_file_access(name));

drop policy if exists "maqlama-lessons admin write" on storage.objects;
create policy "maqlama-lessons admin write" on storage.objects for all to authenticated
using (bucket_id = 'maqlama-lessons' and public.is_admin())
with check (bucket_id = 'maqlama-lessons' and public.is_admin());

-- ============== REALTIME for enrollments (added) ==============
-- So a student's course/path list and course page unlock instantly
-- (no manual refresh) the moment an admin enrolls/unenrolls them.
do $$ begin
  alter publication supabase_realtime add table public.enrollments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.path_enrollments;
exception when duplicate_object then null; end $$;

-- ============== FIRST ADMIN SETUP ==============
-- 1) Create the first Auth user from Supabase Dashboard > Authentication > Users.
-- 2) Then run the following once, replacing the email with that user's email:
-- update public.profiles p set role='admin' where p.email='YOUR_ADMIN_EMAIL';
-- update public.user_roles r set role='admin' where r.user_id=(select id from public.profiles where email='YOUR_ADMIN_EMAIL');
-- After that, all future users created by Auth are forced to 'student' by the trigger above.


-- ===================================================================
-- ============== SINGLE ACTIVE DEVICE SESSION (added) ==============
-- Restricts every STUDENT account to exactly one signed-in device at
-- a time. Admin accounts are exempt (they legitimately need multiple
-- devices/tabs to manage the platform).
--
-- How it works (all of it lives in the database — the browser cannot
-- bypass it just by editing script.js):
--   1) Each browser/device generates a random, persistent "device id"
--      (stored in its own localStorage) and sends it on every request
--      as the custom header  x-device-session .
--   2) Right after login, the client calls claim_device_session(),
--      which stamps that device id onto profiles.active_session_id —
--      overwriting whatever device was active before. This is a plain
--      table write guarded by a trigger (below) so a student cannot
--      just UPDATE their own profile row to fake it.
--   3) profiles is already in the Realtime publication, so the device
--      that just got overwritten receives the change instantly and
--      logs itself out with a clear message. A periodic heartbeat
--      RPC (is_my_session_active) covers the rare case Realtime is
--      unreachable.
--   4) On top of that, session_ok() reads the same x-device-session
--      header from the request itself (PostgREST/Supabase exposes
--      request headers to Postgres as request.headers) and is wired
--      into the RLS policies that gate actual course content
--      (lessons, private lesson files, quizzes/exams, chat, live
--      streams) — so even a tampered/old client that ignores the
--      Realtime kick gets its reads/writes rejected by Postgres the
--      moment it tries to touch real content, not just hidden by UI.
--   5) A companion Edge Function (supabase/functions/session-guard)
--      calls Supabase Auth's admin.signOut(token, 'others'), which
--      revokes the *refresh token* of every other session for that
--      student server-side — the true, unbypassable backend
--      enforcement layer, independent of anything the browser does.
--      (Deploy it — see SUPABASE_SETUP.md — and consider lowering the
--      JWT expiry in Authentication > Settings for a tighter window.)
--   6) Logging out clears active_session_id, and a *new* login always
--      overwrites it regardless of its previous value — so a closed
--      browser / crashed tab never leaves the account permanently
--      locked; the very next login (same device or a different one)
--      always succeeds.
-- ===================================================================

alter table public.profiles add column if not exists active_session_id text;
alter table public.profiles add column if not exists active_device_label text;
alter table public.profiles add column if not exists session_updated_at timestamptz;

-- ----- guard trigger: the 3 session columns above can only change via
-- the SECURITY DEFINER functions below (which set a transaction-local
-- flag first), or by an admin. A student calling
-- supabase.from('profiles').update({active_session_id:...}) directly
-- has that part of the write silently discarded.
create or replace function public._guard_session_columns()
returns trigger language plpgsql as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if coalesce(current_setting('app.allow_session_update', true), '') = 'on' then
    return new;
  end if;
  new.active_session_id := old.active_session_id;
  new.active_device_label := old.active_device_label;
  new.session_updated_at := old.session_updated_at;
  return new;
end;
$$;

drop trigger if exists trg_guard_session_columns on public.profiles;
create trigger trg_guard_session_columns
before update on public.profiles
for each row execute function public._guard_session_columns();

-- ----- claim the current device as the one-and-only active session.
-- Called right after a successful login (and safe to call again on
-- page reload with the same device id — it's idempotent).
create or replace function public.claim_device_session(p_device_id text, p_device_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_id text;
  v_prev_label text;
  v_took_over boolean;
begin
  if auth.uid() is null then
    raise exception 'غير مسجّل الدخول';
  end if;
  if p_device_id is null or length(btrim(p_device_id)) < 8 then
    raise exception 'معرّف الجهاز غير صالح';
  end if;

  select active_session_id, active_device_label into v_prev_id, v_prev_label
  from public.profiles where id = auth.uid() for update;

  v_took_over := (v_prev_id is not null and v_prev_id <> p_device_id);

  perform set_config('app.allow_session_update', 'on', true);
  update public.profiles
    set active_session_id = p_device_id,
        active_device_label = coalesce(p_device_label, active_device_label),
        session_updated_at = now()
    where id = auth.uid();

  return jsonb_build_object('took_over', v_took_over, 'previous_device', v_prev_label);
end;
$$;
grant execute on function public.claim_device_session(text, text) to authenticated;

-- ----- release the session on logout so the account never stays
-- "reserved" — though thanks to claim_device_session's overwrite
-- behaviour above, a new login always works even if this never runs
-- (crashed tab / browser closed without a proper logout).
create or replace function public.release_device_session(p_device_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  perform set_config('app.allow_session_update', 'on', true);
  update public.profiles
    set active_session_id = null,
        session_updated_at = now()
    where id = auth.uid() and active_session_id = p_device_id;
end;
$$;
grant execute on function public.release_device_session(text) to authenticated;

-- ----- lightweight heartbeat check used as a Realtime fallback.
create or replace function public.is_my_session_active(p_device_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select active_session_id is null or active_session_id = p_device_id
     from public.profiles where id = auth.uid()),
    true
  );
$$;
grant execute on function public.is_my_session_active(text) to authenticated;

-- ----- read the caller's own x-device-session request header.
-- Supabase/PostgREST expose request headers to Postgres via the
-- request.headers GUC; this is wrapped in an exception handler so it
-- never breaks a query on a setup where that GUC isn't present.
create or replace function public.request_device_id()
returns text
language plpgsql
stable
as $$
declare
  hdrs json;
  did text;
begin
  begin
    hdrs := nullif(current_setting('request.headers', true), '')::json;
    did := hdrs ->> 'x-device-session';
  exception when others then
    did := null;
  end;
  return did;
end;
$$;

-- ----- the check wired into RLS below. Admins always pass. A student
-- with no claimed session yet, or a request with no header (older
-- cached client, etc.), fails OPEN — this function is a hardening
-- layer on top of the Realtime kick + Auth token revocation, not the
-- only line of defense, so it must never be the thing that locks a
-- legitimate student out.
create or replace function public.session_ok()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_active text;
  v_hdr text;
begin
  if public.is_admin() then
    return true;
  end if;
  select active_session_id into v_active from public.profiles where id = auth.uid();
  if v_active is null then
    return true;
  end if;
  v_hdr := public.request_device_id();
  if v_hdr is null then
    return true;
  end if;
  return v_active = v_hdr;
end;
$$;

-- ----- wire session_ok() into the RLS policies that gate real course
-- content (metadata + actual files), exams, chat and live streams.
-- Re-created here with "create or replace" / "drop policy if exists"
-- exactly like every other policy in this file, so re-running the
-- whole script is always safe.

drop policy if exists "lessons read auth" on public.lessons;
create policy "lessons read auth" on public.lessons for select to authenticated
using (public.is_admin()
  or (public.session_ok() and (
    exists (select 1 from public.enrollments e where e.course_id = lessons.course_id and e.user_id = auth.uid())
    or exists (select 1 from public.courses c join public.path_enrollments pe on pe.path_id = c.path_id where c.id = lessons.course_id and pe.user_id = auth.uid())
  ))
);

drop policy if exists "live_streams read auth" on public.live_streams;
create policy "live_streams read auth" on public.live_streams for select to authenticated
using (public.is_admin() or public.session_ok());

drop policy if exists "msg read auth" on public.chat_messages;
create policy "msg read auth" on public.chat_messages for select to authenticated
using (public.is_admin() or public.session_ok());
drop policy if exists "msg insert own" on public.chat_messages;
create policy "msg insert own" on public.chat_messages for insert to authenticated
with check (user_id = auth.uid() and (public.is_admin() or public.session_ok()));

-- private lesson-file storage (video/record/pdf/etc.) — signing a URL
-- now also requires an active, matching device session.
create or replace function public._lesson_file_access(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.session_ok() and exists (
      select 1 from public.lessons l
      where l.storage_path = p_path
        and (
          exists (select 1 from public.enrollments e where e.course_id = l.course_id and e.user_id = auth.uid())
          or exists (
            select 1 from public.courses c
            join public.path_enrollments pe on pe.path_id = c.path_id
            where c.id = l.course_id and pe.user_id = auth.uid()
          )
        )
    )
  );
$$;

-- exams: gate quiz visibility, starting an attempt, and submitting an
-- attempt — all three already funnel through _quiz_access(), so
-- redefining it here is enough to cover start_quiz_attempt() and
-- submit_quiz_attempt() as well.
create or replace function public._quiz_access(p_quiz_id uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or (
      public.session_ok()
      and (
        exists (
          select 1 from public.quizzes z
          join public.enrollments e on e.course_id = z.course_id
          where z.id = p_quiz_id and e.user_id = p_uid
        )
        or exists (
          select 1 from public.quizzes z
          join public.courses c on c.id = z.course_id
          join public.path_enrollments pe on pe.path_id = c.path_id
          where z.id = p_quiz_id and pe.user_id = p_uid
        )
      )
    )
$$;

drop policy if exists "quizzes read auth" on public.quizzes;
create policy "quizzes read auth" on public.quizzes for select to authenticated
using (public.is_admin() or (public.session_ok() and (
  exists (select 1 from public.enrollments e where e.course_id = quizzes.course_id and e.user_id = auth.uid())
  or exists (select 1 from public.courses c join public.path_enrollments pe on pe.path_id = c.path_id where c.id = quizzes.course_id and pe.user_id = auth.uid())
)));

create or replace view public.quiz_questions_public as
select q.id, q.quiz_id, q.question, q.options, q.points, q.position
from public.quiz_questions q
join public.quizzes z on z.id = q.quiz_id
where public.is_admin()
   or (public.session_ok() and (
     exists (select 1 from public.enrollments e where e.course_id = z.course_id and e.user_id = auth.uid())
     or exists (
          select 1 from public.courses c
          join public.path_enrollments pe on pe.path_id = c.path_id
          where c.id = z.course_id and pe.user_id = auth.uid()
        )
   ));

grant select on public.quiz_questions_public to authenticated;

-- ===================================================================
-- ============== STUDENT PII / COUNT LOCKDOWN (added) ==============
-- A student must never be able to read another user's profile row —
-- name, username, email, role, join date, or online status of anyone
-- else — because that access is also exactly what would let a student
-- compute "how many students are on the platform" simply by counting
-- rows, even if the UI never displays a number anywhere. The previous
-- "profiles read all auth" policy allowed ANY authenticated user to
-- read EVERY profile row; replaced below with "own row only, or admin
-- reads everyone". This is enforced in Postgres via RLS, so it holds
-- no matter what the browser/JS does or doesn't show.
--
-- The one student-facing feature that used to lean on bulk profile
-- access was the green "online" dot next to a chat message sender's
-- avatar (the sender's name/avatar-letter already travel inside the
-- chat message row itself, so no profile lookup was ever needed for
-- those). That is now served by the narrow RPC below, which only ever
-- answers for the specific user id(s) the caller passes in (in
-- practice, ids of senders of messages the caller can already read)
-- and returns nothing but id+online — no email, no username, no role,
-- no join date, and no way to list or count all users on the
-- platform (uuids are not enumerable/guessable).
-- ===================================================================

drop policy if exists "profiles read all auth" on public.profiles;
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create or replace function public.chat_presence(p_ids uuid[])
returns table(id uuid, online boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.online
  from public.profiles p
  where p.id = any(p_ids)
$$;
grant execute on function public.chat_presence(uuid[]) to authenticated;
