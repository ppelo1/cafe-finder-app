-- 카페찾기 DB 스키마 (여러 번 실행해도 안전하게 작성됨)
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run.

-- ========== 테이블 ==========
create table if not exists cafes (
  id bigint generated always as identity primary key,
  name text not null,
  dong text default '',
  address text not null,
  phone text default '',
  naver_name text default '',
  naver_link text default '',
  tags jsonb not null default '{}',
  outlet_range text default 'none',
  seats integer not null default 0,
  rating numeric not null default 0,
  hours text default '정보 없음',
  weekly_hours jsonb,
  description text default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null
);

create table if not exists reviews (
  id bigint generated always as identity primary key,
  cafe_id bigint not null references cafes(id) on delete cascade,
  rating integer not null default 0,
  text text default '',
  images jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  cafe_id bigint not null,
  memo text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, cafe_id)
);
alter table favorites add column if not exists memo text not null default '';

-- ========== 행 단위 보안(RLS) ==========
alter table cafes     enable row level security;
alter table reviews   enable row level security;
alter table favorites enable row level security;

drop policy if exists "카페 목록은 누구나 조회"   on cafes;
drop policy if exists "로그인한 사람만 카페 등록"  on cafes;
create policy "카페 목록은 누구나 조회"  on cafes for select using (true);
create policy "로그인한 사람만 카페 등록" on cafes for insert with check (auth.uid() is not null);

drop policy if exists "리뷰는 누구나 조회"        on reviews;
drop policy if exists "로그인한 사람만 리뷰 작성"  on reviews;
create policy "리뷰는 누구나 조회"       on reviews for select using (true);
create policy "로그인한 사람만 리뷰 작성" on reviews for insert with check (auth.uid() is not null);

drop policy if exists "본인 즐겨찾기만 조회" on favorites;
drop policy if exists "본인 즐겨찾기만 추가" on favorites;
drop policy if exists "본인 즐겨찾기만 수정" on favorites;
drop policy if exists "본인 즐겨찾기만 삭제" on favorites;
create policy "본인 즐겨찾기만 조회" on favorites for select using (auth.uid() = user_id);
create policy "본인 즐겨찾기만 추가" on favorites for insert with check (auth.uid() = user_id);
create policy "본인 즐겨찾기만 수정" on favorites for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "본인 즐겨찾기만 삭제" on favorites for delete using (auth.uid() = user_id);

-- ========== 사진 저장소 (선택) ==========
insert into storage.buckets (id, name, public)
values ('cafe-photos', 'cafe-photos', true)
on conflict (id) do nothing;

drop policy if exists "카페 사진은 누구나 조회"     on storage.objects;
drop policy if exists "로그인한 사람만 사진 업로드"  on storage.objects;
create policy "카페 사진은 누구나 조회"    on storage.objects for select using (bucket_id = 'cafe-photos');
create policy "로그인한 사람만 사진 업로드" on storage.objects for insert with check (bucket_id = 'cafe-photos' and auth.uid() is not null);

-- ========== 초기 카페 (테이블이 비어 있을 때만) ==========
insert into cafes (name, dong, address, tags, seats, rating, hours, description, lat, lng)
select * from (values
  ('브루웍스 연남', '연남동', '연남동 227-3', '{"outlet":true,"large":true,"interior":true,"parking":false,"cute":false}'::jsonb, 68, 4.6, '08:00 - 23:00', '층고가 높은 창고형 공간, 2층 전체가 스터디존', 37.5599, 126.9255),
  ('카페 소슬', '합정동', '합정동 371-12', '{"outlet":true,"large":false,"interior":true,"parking":true,"cute":true}'::jsonb, 22, 4.8, '10:00 - 22:00', '작지만 자리마다 콘센트 완비, 조용한 분위기', 37.5495, 126.9135),
  ('그로브 하우스', '망원동', '망원동 402-1', '{"outlet":false,"large":true,"interior":true,"parking":true,"cute":false}'::jsonb, 90, 4.4, '09:00 - 24:00', '식물이 가득한 온실 컨셉, 사진 찍기 좋은 곳', 37.5555, 126.9020),
  ('스터디 앤 빈', '연남동', '연남동 340-5', '{"outlet":true,"large":true,"interior":false,"parking":false,"cute":false}'::jsonb, 74, 4.3, '24시간', '전 좌석 콘센트, 스터디카페에 가까운 실용적 공간', 37.5615, 126.9245),
  ('아뜰리에 문', '상수동', '상수동 12-4', '{"outlet":false,"large":false,"interior":true,"parking":false,"cute":true}'::jsonb, 18, 4.9, '11:00 - 21:00', '갤러리 같은 인테리어, 원목 소품이 인상적', 37.5478, 126.9225),
  ('파크뷰 로스터리', '망원동', '망원동 55-9', '{"outlet":true,"large":true,"interior":true,"parking":true,"cute":false}'::jsonb, 110, 4.5, '08:30 - 22:30', '공원 앞 대형 로스터리 카페, 주차 20대 가능', 37.5545, 126.9005),
  ('카페 온기', '합정동', '합정동 158-2', '{"outlet":true,"large":false,"interior":false,"parking":true,"cute":true}'::jsonb, 26, 4.1, '09:00 - 21:00', '동네 단골이 많은 조용한 로컬 카페', 37.5502, 126.9150),
  ('라이트룸', '연남동', '연남동 190-7', '{"outlet":true,"large":false,"interior":true,"parking":false,"cute":true}'::jsonb, 30, 4.7, '10:00 - 23:00', '채광이 좋은 통유리 공간, 오후엔 대기줄 있음', 37.5605, 126.9270),
  ('베이스캠프 커피', '상수동', '상수동 88-1', '{"outlet":true,"large":true,"interior":false,"parking":true,"cute":false}'::jsonb, 82, 4.2, '07:00 - 23:00', '노트북 작업하는 사람들이 많은 넓은 좌석 배치', 37.5468, 126.9210)
) as v(name, dong, address, tags, seats, rating, hours, description, lat, lng)
where not exists (select 1 from cafes);
