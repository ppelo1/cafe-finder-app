# 로그인(카카오·구글) + 즐겨찾기 설정

두 가지 모드가 있습니다.

| 모드 | `.env` | 로그인 | 즐겨찾기 저장 |
|---|---|---|---|
| **로컬 테스트** | `VITE_DEV_LOGIN=true` | SNS 인증 없이 버튼 누르면 바로 | 계정 id별 `localStorage` |
| **실제** | `VITE_SUPABASE_*` + Supabase/카카오/구글 설정 | 진짜 카카오·구글 OAuth | Supabase `favorites` 테이블 |

`VITE_DEV_LOGIN=true` 면 아래 1~5 단계는 건너뛰어도 됩니다. 네이버 검색 키처럼
`.env` 값 하나로 켜고 끄며, 배포할 땐 `false` 로 두고 실제 설정을 씁니다.

---

## 0. 로컬 테스트 모드 (설정 없이)

```
# .env
VITE_DEV_LOGIN=true
```

`npm run dev` → 상세보기의 즐겨찾기 버튼 → 팝업에서 "카카오/구글로 계속하기"
누르면 즉시 로그인(로컬 계정). 즐겨찾기가 그 계정 기준으로 `localStorage`에 저장되고
지도 우측 즐겨찾기 토글도 동작합니다. `카카오`/`구글`은 각각 별도 계정으로 취급됩니다.

> 실제 배포 전에 `VITE_DEV_LOGIN=false` 로 바꾸고 아래 실제 설정을 완료하세요.

---

## 1. Supabase 프로젝트  *(실제 모드)*

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

> 카카오 콘솔 메뉴 구조가 자주 바뀝니다. 아래는 2026년 기준 위치이며,
> 핵심은 **카카오 Redirect URI = 앱 주소가 아니라 Supabase 콜백 주소** 라는 점.
> GitHub Pages 는 정적 호스팅이라 콜백을 처리 못 하므로 Supabase 가 중간에서 받습니다.

1. https://developers.kakao.com → **내 애플리케이션** → 애플리케이션 추가
2. **앱 설정 → 플랫폼 → Web** 사이트 도메인 등록: `http://localhost:5173`, 배포 도메인
3. **카카오 로그인 → 일반** → **사용 설정** ON
4. 같은 **카카오 로그인 → 일반** 페이지의 **Redirect URI** 에 Supabase 콜백 추가:
   `https://<프로젝트ref>.supabase.co/auth/v1/callback`
   (`<프로젝트ref>` = `VITE_SUPABASE_URL` 의 서브도메인. Supabase Providers→Kakao 화면에도
   "Callback URL (for OAuth)" 로 그대로 적혀 있음)
5. **카카오 로그인 → 동의항목** : `닉네임` = 필수 동의, `카카오계정(이메일)` = 선택 동의
   (이메일을 필수로 받으려면 비즈앱 전환 필요 → 테스트는 선택 동의로 충분)
6. **Client Secret** (선택 - 건너뛰어도 대부분 동작):
   `카카오 로그인 → 일반` 또는 `고급` 하단의 Client Secret 섹션에서 코드 발급 + `사용함`.
   메뉴에서 안 보이면 `앱 설정 → 앱 키` 페이지 하단도 확인. 못 찾으면 비워둔 채 진행.
7. `앱 설정 → 앱 키` 의 **REST API 키** 복사 → Supabase
   **Authentication → Providers → Kakao** 활성화:
   - REST API 키 → `REST API Key (Client ID)`
   - (있으면) Client Secret → `Client Secret`
   - Enable → **Save**

## 4. 구글 로그인

1. https://console.cloud.google.com → APIs & Services → Credentials
2. **OAuth client ID** 생성 (Application type: Web)
3. **Authorized redirect URIs** 에 Supabase 콜백 추가:
   `https://<프로젝트ref>.supabase.co/auth/v1/callback`
4. 생성된 Client ID / Client Secret 을 Supabase
   **Authentication → Providers → Google** 에 입력, 활성화

## 5-B. 로그인이 "Unable to exchange external code" 로 실패할 때

Kakao 로그인 화면까지는 뜨는데 로그인 후 실패하면, **거의 항상 Client Secret 불일치**입니다.
(Supabase 가 Kakao 토큰 엔드포인트에 코드 교환 요청을 보내는데 `client_secret` 이 안 맞음)

둘 중 하나로 맞추세요:

- **A. 양쪽 다 끄기** (간단):
  - Kakao 콘솔 → Client Secret → **활성화 상태 = 사용 안 함**
  - Supabase → Providers → Kakao → `Client Secret` 칸 **비움** → Save
- **B. 양쪽 다 켜고 값 일치**:
  - Kakao 콘솔에서 Client Secret 코드 발급 + **활성화 상태 = 사용함**
  - 그 코드를 Supabase `Client Secret` 칸에 정확히 붙여넣기 → Save

그래도 안 되면 확인:
- Supabase → **Authentication → URL Configuration → Redirect URLs** 에
  `http://localhost:5173/` (또는 `http://localhost:5173/**`) 와 배포 주소가 있는지
- Kakao → **동의항목** 에서 `카카오계정(이메일)` 이 최소 **선택 동의** 인지
  (Supabase 가 요청하는 scope 에 `account_email` 이 포함됨)

## 5. 확인

```
npm run dev
```

- 상세보기의 **즐겨찾기** 버튼 → 로그인 안 됐으면 팝업(카카오/구글)
- 로그인 후 즐겨찾기 → (실제 모드) Supabase `favorites` 테이블에 행 생성 /
  (로컬 테스트 모드) `localStorage` 에 저장
- 지도 우측 하단 **즐겨찾기** 토글 → 즐겨찾기한 카페만 지도에 표시
- 지도 우측의 원형 버튼(이니셜) → 로그아웃

`.env` 를 바꿨으면 `npm run dev` 를 껐다 켜야 반영됩니다.

> 참고: 테스트 단계라 카페 목록은 아직 브라우저 localStorage 에 있습니다.
> `favorites.cafe_id` 는 프론트엔드가 쓰는 로컬 카페 id 를 그대로 저장하며,
> 카페 목록을 Supabase 로 옮길 때 id 매핑을 맞춰야 합니다.
