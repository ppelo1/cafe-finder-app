import { createClient } from "@supabase/supabase-js";

// .env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 로 설정한다.
// (설정 방법은 docs/auth-setup.md 참고)
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// 로컬 테스트용: VITE_DEV_LOGIN=true 이면 SNS/서버 설정 없이 바로 로그인된다.
// (네이버 검색 키처럼 .env 값 하나로 켜고 끔)
export const devLoginEnabled =
  import.meta.env.VITE_DEV_LOGIN === "true" || import.meta.env.VITE_DEV_LOGIN === "1";

// 키가 없으면 null 을 내보내고, 앱은 로그인 없이 그대로 동작한다.
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
