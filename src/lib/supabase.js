import { createClient } from "@supabase/supabase-js";

// .env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 로 설정한다.
// (설정 방법은 docs/auth-setup.md 참고)
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// 로컬 UI 확인용 목업 로그인: 개발 서버(import.meta.env.DEV)에서 VITE_DEV_LOGIN=true 일 때만.
// 프로덕션 빌드에서는 이 플래그가 켜져 있어도 절대 목업 로그인되지 않는다.
export const devLoginEnabled =
  import.meta.env.DEV &&
  (import.meta.env.VITE_DEV_LOGIN === "true" || import.meta.env.VITE_DEV_LOGIN === "1");

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
