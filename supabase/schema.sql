-- 카페찾기 DB 스키마
-- Supabase 대시보드 좌측 메뉴의 "SQL Editor"에서 이 파일 내용을 전부 붙여넣고
-- 우측 상단 "Run" 버튼을 누르면 테이블/보안규칙/초기 데이터가 한 번에 만들어집니다.

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
  lat double precision not null,
  lng double precision not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
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

-- 행 단위 보안(RLS): 조회는 누구나 가능, 등록/리뷰 작성은 로그인한 사람만.
alter table cafes enable row level security;
alter table reviews enable row level security;

create policy "카페 목록은 누구나 조회" on cafes for select using (true);
create policy "로그인한 사람만 카페 등록" on cafes for insert with check (auth.uid() is not null);

create policy "리뷰는 누구나 조회" on reviews for select using (true);
create policy "로그인한 사람만 리뷰 작성" on reviews for insert with check (auth.uid() is not null);

-- 사진 업로드용 저장소: "cafe-photos" 버킷을 공개(public)로 생성.
insert into storage.buckets (id, name, public)
values ('cafe-photos', 'cafe-photos', true)
on conflict (id) do nothing;

create policy "카페 사진은 누구나 조회" on storage.objects for select
  using (bucket_id = 'cafe-photos');
create policy "로그인한 사람만 사진 업로드" on storage.objects for insert
  with check (bucket_id = 'cafe-photos' and auth.uid() is not null);

-- 초기 목업 데이터 (기존 프론트엔드에 있던 9개 카페)
insert into cafes (name, dong, address, tags, seats, rating, hours, description, lat, lng) values
  ('브루웍스 연남', '연남동', '연남동 227-3', '{"outlet":true,"large":true,"interior":true,"parking":false,"cute":false}', 68, 4.6, '08:00 - 23:00', '층고가 높은 창고형 공간, 2층 전체가 스터디존', 37.5599, 126.9255),
  ('카페 소슬', '합정동', '합정동 371-12', '{"outlet":true,"large":false,"interior":true,"parking":true,"cute":true}', 22, 4.8, '10:00 - 22:00', '작지만 자리마다 콘센트 완비, 조용한 분위기', 37.5495, 126.9135),
  ('그로브 하우스', '망원동', '망원동 402-1', '{"outlet":false,"large":true,"interior":true,"parking":true,"cute":false}', 90, 4.4, '09:00 - 24:00', '식물이 가득한 온실 컨셉, 사진 찍기 좋은 곳', 37.5555, 126.9020),
  ('스터디 앤 빈', '연남동', '연남동 340-5', '{"outlet":true,"large":true,"interior":false,"parking":false,"cute":false}', 74, 4.3, '24시간', '전 좌석 콘센트, 스터디카페에 가까운 실용적 공간', 37.5615, 126.9245),
  ('아뜰리에 문', '상수동', '상수동 12-4', '{"outlet":false,"large":false,"interior":true,"parking":false,"cute":true}', 18, 4.9, '11:00 - 21:00', '갤러리 같은 인테리어, 원목 소품이 인상적', 37.5478, 126.9225),
  ('파크뷰 로스터리', '망원동', '망원동 55-9', '{"outlet":true,"large":true,"interior":true,"parking":true,"cute":false}', 110, 4.5, '08:30 - 22:30', '공원 앞 대형 로스터리 카페, 주차 20대 가능', 37.5545, 126.9005),
  ('카페 온기', '합정동', '합정동 158-2', '{"outlet":true,"large":false,"interior":false,"parking":true,"cute":true}', 26, 4.1, '09:00 - 21:00', '동네 단골이 많은 조용한 로컬 카페', 37.5502, 126.9150),
  ('라이트룸', '연남동', '연남동 190-7', '{"outlet":true,"large":false,"interior":true,"parking":false,"cute":true}', 30, 4.7, '10:00 - 23:00', '채광이 좋은 통유리 공간, 오후엔 대기줄 있음', 37.5605, 126.9270),
  ('베이스캠프 커피', '상수동', '상수동 88-1', '{"outlet":true,"large":true,"interior":false,"parking":true,"cute":false}', 82, 4.2, '07:00 - 23:00', '노트북 작업하는 사람들이 많은 넓은 좌석 배치', 37.5468, 126.9210)
on conflict do nothing;
