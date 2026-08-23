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

-- ============== FIRST ADMIN SETUP ==============
-- 1) Create the first Auth user from Supabase Dashboard > Authentication > Users.
-- 2) Then run the following once, replacing the email with that user's email:
-- update public.profiles p set role='admin' where p.email='YOUR_ADMIN_EMAIL';
-- update public.user_roles r set role='admin' where r.user_id=(select id from public.profiles where email='YOUR_ADMIN_EMAIL');
-- After that, all future users created by Auth are forced to 'student' by the trigger above.
