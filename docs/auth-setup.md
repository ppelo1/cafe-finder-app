# 로그인(카카오·구글) + 즐겨찾기 설정

즐겨찾기는 Supabase Auth로 로그인한 계정에 저장됩니다. 키가 없으면 앱은
로그인 없이 그대로 동작하고, 즐겨찾기 버튼을 누르면 "설정되지 않았습니다" 안내가 나옵니다.

## 1. Supabase 프로젝트

1. https://supabase.com 에서 프로젝트 생성
2. **Project Settings → API** 에서
   - `Project URL` → `.env` 의 `VITE_SUPABASE_URL`
   - `anon` `public` key → `.env` 의 `VITE_SUPABASE_ANON_KEY`
3. **SQL Editor** 에서 `supabase/schema.sql` 전체를 붙여넣고 Run
   (`favorites` 테이블 + RLS 정책이 함께 만들어집니다)

## 2. 리다이렉트 URL 등록

**Authentication → URL Configuration → Redirect URLs** 에 추가:

- `http://localhost:5173/`
- `http://localhost:5173/cafe-finder-app/` (GITHUB_PAGES 빌드로 로컬 확인 시)
- 배포 주소: `https://<깃허브아이디>.github.io/cafe-finder-app/`

`Site URL` 은 배포 주소로 지정.

## 3. 카카오 로그인

1. https://developers.kakao.com → 애플리케이션 추가
2. **앱 설정 → 플랫폼 → Web** 에 사이트 도메인 등록
   (`http://localhost:5173`, 배포 도메인)
3. **카카오 로그인** 활성화 ON
4. **Redirect URI** 에 Supabase 콜백 추가:
   `https://<프로젝트ref>.supabase.co/auth/v1/callback`
5. **동의 항목** 에서 닉네임/이메일 등 필요한 항목 설정
6. **보안 → Client Secret** 발급(코드 생성 ON)
7. Supabase **Authentication → Providers → Kakao** 활성화 후
   - REST API 키 → `Client ID`
   - Client Secret → `Client Secret`

## 4. 구글 로그인

1. https://console.cloud.google.com → APIs & Services → Credentials
2. **OAuth client ID** 생성 (Application type: Web)
3. **Authorized redirect URIs** 에 Supabase 콜백 추가:
   `https://<프로젝트ref>.supabase.co/auth/v1/callback`
4. 생성된 Client ID / Client Secret 을 Supabase
   **Authentication → Providers → Google** 에 입력, 활성화

## 5. 확인

```
npm run dev
```

- 상세보기의 **즐겨찾기** 버튼 → 로그인 안 됐으면 팝업(카카오/구글)
- 로그인 후 즐겨찾기 → Supabase `favorites` 테이블에 행 생성
- 지도 우측 하단 **즐겨찾기** 토글 → 즐겨찾기한 카페만 지도에 표시
- 지도 우측의 원형 버튼(이니셜) → 로그아웃

> 참고: 테스트 단계라 카페 목록은 아직 브라우저 localStorage 에 있습니다.
> `favorites.cafe_id` 는 프론트엔드가 쓰는 로컬 카페 id 를 그대로 저장하며,
> 카페 목록을 Supabase 로 옮길 때 id 매핑을 맞춰야 합니다.
