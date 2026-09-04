import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import logoCupImg from "./assets/icons/logo-cafe-cup.png";
import searchIconImg from "./assets/icons/icon-search.png";
import filterIconImg from "./assets/icons/icon-filter.png";
import openNowIconImg from "./assets/icons/icon-open-now.png";
import largeCafeIconImg from "./assets/icons/icon-large-cafe.png";
import interiorIconImg from "./assets/icons/icon-interior.png";
import mapIconImg from "./assets/icons/icon-map.png";
import listIconImg from "./assets/icons/icon-list.png";
import registerIconImg from "./assets/icons/icon-cafe-register.png";
import pinCafeImg from "./assets/icons/map-pin-cafe.png";
import pinCafeSelectedImg from "./assets/icons/map-pin-cafe-selected.png";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

/* =========================================================================
   네이버 지도 연동 안내
   1) https://www.ncloud.com -> Console -> AI·NAVER API -> Maps 신청
   2) 발급받은 "Client ID"를 아래 NAVER_CONFIG.clientId 에 붙여넣으세요
   3) 콘솔에서 서비스 URL(도메인)에 이 앱이 배포될 주소를 등록해야 정상 동작해요
   4) clientId가 비어있으면 자동으로 목업(일러스트) 지도로 대체됩니다
   ========================================================================= */
const NAVER_CONFIG = {
  clientId: "tkv9djbq39",
};

/* =========================================================================
   네이버 장소 검색(등록 화면) 연동 안내 - GitHub Pages처럼 백엔드 서버가 없는
   환경에서는 Cloudflare Worker(프록시)를 거쳐 네이버 검색 API를 호출합니다.
   네이버 API 키는 브라우저에 노출되지 않고 Worker 쪽 Secret으로만 보관됩니다.
   ========================================================================= */
const SEARCH_PROXY_URL = "https://cafe-search-proxy.ppelo.workers.dev";

async function fetchNaverPlaces(query) {
  const response = await fetch(`${SEARCH_PROXY_URL}?query=${encodeURIComponent(query)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "네이버 장소 검색에 실패했습니다.");
  }
  return data.places || [];
}

/* 목업 지도용 좌표 변환 기준 박스 (마포구 연남·합정·망원·상수 일대 근사치) */
const BOUNDS = { minLat: 37.541, maxLat: 37.560, minLng: 126.905, maxLng: 126.925 };
function latLngToXY(lat, lng) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 92 + 4;
  const y = (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 92 + 4;
  return { x, y };
}

/* 테스트 단계 로컬 저장소 키 (백엔드 구성 전까지 사용) */
const CAFES_STORAGE_KEY = "cafe-finder:cafes";

/* ---------- 초기 목업 데이터 (실좌표 포함) ---------- */
const INITIAL_CAFES = [
  { id: 1, name: "브루웍스 연남", dong: "연남동", address: "연남동 227-3",
    tags: { outlet: true, large: true, interior: true, parking: false, cute: false },
    seats: 68, rating: 4.6, hours: "08:00 - 23:00",
    desc: "층고가 높은 창고형 공간, 2층 전체가 스터디존",
    lat: 37.5599, lng: 126.9255 },
  { id: 2, name: "카페 소슬", dong: "합정동", address: "합정동 371-12",
    tags: { outlet: true, large: false, interior: true, parking: true, cute: true },
    seats: 22, rating: 4.8, hours: "10:00 - 22:00",
    desc: "작지만 자리마다 콘센트 완비, 조용한 분위기",
    lat: 37.5495, lng: 126.9135 },
  { id: 3, name: "그로브 하우스", dong: "망원동", address: "망원동 402-1",
    tags: { outlet: false, large: true, interior: true, parking: true, cute: false },
    seats: 90, rating: 4.4, hours: "09:00 - 24:00",
    desc: "식물이 가득한 온실 컨셉, 사진 찍기 좋은 곳",
    lat: 37.5555, lng: 126.9020 },
  { id: 4, name: "스터디 앤 빈", dong: "연남동", address: "연남동 340-5",
    tags: { outlet: true, large: true, interior: false, parking: false, cute: false },
    seats: 74, rating: 4.3, hours: "24시간",
    desc: "전 좌석 콘센트, 스터디카페에 가까운 실용적 공간",
    lat: 37.5615, lng: 126.9245 },
  { id: 5, name: "아뜰리에 문", dong: "상수동", address: "상수동 12-4",
    tags: { outlet: false, large: false, interior: true, parking: false, cute: true },
    seats: 18, rating: 4.9, hours: "11:00 - 21:00",
    desc: "갤러리 같은 인테리어, 원목 소품이 인상적",
    lat: 37.5478, lng: 126.9225 },
  { id: 6, name: "파크뷰 로스터리", dong: "망원동", address: "망원동 55-9",
    tags: { outlet: true, large: true, interior: true, parking: true, cute: false },
    seats: 110, rating: 4.5, hours: "08:30 - 22:30",
    desc: "공원 앞 대형 로스터리 카페, 주차 20대 가능",
    lat: 37.5545, lng: 126.9005 },
  { id: 7, name: "카페 온기", dong: "합정동", address: "합정동 158-2",
    tags: { outlet: true, large: false, interior: false, parking: true, cute: true },
    seats: 26, rating: 4.1, hours: "09:00 - 21:00",
    desc: "동네 단골이 많은 조용한 로컬 카페",
    lat: 37.5502, lng: 126.9150 },
  { id: 8, name: "라이트룸", dong: "연남동", address: "연남동 190-7",
    tags: { outlet: true, large: false, interior: true, parking: false, cute: true },
    seats: 30, rating: 4.7, hours: "10:00 - 23:00",
    desc: "채광이 좋은 통유리 공간, 오후엔 대기줄 있음",
    lat: 37.5605, lng: 126.9270 },
  { id: 9, name: "베이스캠프 커피", dong: "상수동", address: "상수동 88-1",
    tags: { outlet: true, large: true, interior: false, parking: true, cute: false },
    seats: 82, rating: 4.2, hours: "07:00 - 23:00",
    desc: "노트북 작업하는 사람들이 많은 넓은 좌석 배치",
    lat: 37.5468, lng: 126.9210 },
];

const FILTERS = [
  { key: "outlet", label: "콘센트", icon: OutletIcon },
  { key: "large", label: "대형카페", icon: BuildingIcon },
  { key: "interior", label: "인테리어", icon: SparkleIcon },
  { key: "cute", label: "아기자기함", icon: CuteIcon },
  { key: "parking", label: "주차가능", icon: ParkingIcon },
];

const OUTLET_RANGES = [
  { value: "none", label: "없음" },
  { value: "1-3", label: "1~3석" },
  { value: "4-7", label: "4~7석" },
  { value: "8-15", label: "8~15석" },
  { value: "16-plus", label: "16석 이상" },
];

function outletRangeLabel(cafe) {
  const range = OUTLET_RANGES.find((item) => item.value === cafe.outletRange);
  return range ? `콘센트 ${range.label}` : "콘센트";
}

function inferDong(address, fallback = "") {
  return address.match(/[가-힣]+동/)?.[0] || fallback;
}

function cafeInViewport(cafe, viewport) {
  return !viewport || (cafe.lat >= viewport.minLat && cafe.lat <= viewport.maxLat
    && cafe.lng >= viewport.minLng && cafe.lng <= viewport.maxLng);
}

const DAYS = [
  { key: "mon", label: "월" }, { key: "tue", label: "화" }, { key: "wed", label: "수" },
  { key: "thu", label: "목" }, { key: "fri", label: "금" }, { key: "sat", label: "토" }, { key: "sun", label: "일" },
];

const DEFAULT_WEEKLY_HOURS = Object.fromEntries(
  DAYS.map(({ key }) => [key, { closed: false, open: "09:00", close: "22:00" }])
);

function parseWeeklyHoursText(text, currentHours) {
  const parsedHours = { ...currentHours };
  let parsedCount = 0;
  let pendingDay = null;
  text.split(/\r?\n/).forEach((line) => {
    const dayMatch = line.match(/(월|화|수|목|금|토|일)(?:요일)?/);
    const timeMatch = line.match(/(\d{1,2}):(\d{2})\s*(?:-|~|–|—)\s*(\d{1,2}):(\d{2})/);
    const targetDay = dayMatch ? DAYS.find(({ label }) => label === dayMatch[1]) : pendingDay;
    if (dayMatch && !timeMatch && !/휴무/.test(line)) pendingDay = targetDay;
    if (!targetDay) return;
    if (/휴무/.test(line)) {
      parsedHours[targetDay.key] = { ...parsedHours[targetDay.key], closed: true };
      parsedCount += 1;
      pendingDay = null;
      return;
    }
    if (!timeMatch) return;
    parsedHours[targetDay.key] = {
      closed: false,
      open: `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`,
      close: `${timeMatch[3].padStart(2, "0")}:${timeMatch[4]}`,
    };
    parsedCount += 1;
    pendingDay = null;
  });
  return { parsedHours, parsedCount };
}

function weeklyHoursSummary(weeklyHours) {
  if (!weeklyHours) return null;
  const openDays = DAYS.filter(({ key }) => !weeklyHours[key]?.closed);
  if (openDays.length === 0) return "매일 휴무";
  const first = weeklyHours[openDays[0].key];
  const sameHours = openDays.every(({ key }) => {
    const day = weeklyHours[key];
    return day.open === first.open && day.close === first.close;
  });
  if (openDays.length === DAYS.length && sameHours) return `${first.open} - ${first.close}`;
  return `${openDays.map(({ label }) => label).join(",")} ${sameHours ? `${first.open} - ${first.close}` : "영업"}`;
}

function todayKey() {
  return DAYS[(new Date().getDay() + 6) % 7].key;
}

/* 운영시간 문자열("HH:MM - HH:MM" 또는 "24시간")을 현재 시각과 비교 */
function isOpenNow(hoursStr, weeklyHours) {
  if (weeklyHours) {
    const today = weeklyHours[todayKey()];
    if (!today || today.closed) return false;
    hoursStr = `${today.open} - ${today.close}`;
  }
  if (!hoursStr) return null; // 정보 없음 -> 알 수 없음
  if (hoursStr.includes("24시간")) return true;
  const m = hoursStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const sh = Number(m[1]), sm = Number(m[2]), eh = Number(m[3]), em = Number(m[4]);
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return true;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // 자정을 넘기는 영업시간
}

/* ---------- 아이콘 ---------- */
/* 대표님이 보내주신 아이콘 PNG를 currentColor로 물들일 수 있게 mask-image로 렌더링 */
function MaskIcon({ src, size = 16, color = "currentColor" }) {
  return (
    <span
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
function OutletIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={color} strokeWidth="1.6" />
      <line x1="9" y1="9" x2="9" y2="13" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="15" y1="9" x2="15" y2="13" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 15v3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function BuildingIcon({ size = 16, color = "currentColor" }) {
  return <MaskIcon src={largeCafeIconImg} size={size} color={color} />;
}
function SparkleIcon({ size = 16, color = "currentColor" }) {
  return <MaskIcon src={interiorIconImg} size={size} color={color} />;
}
function ParkingIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={color} strokeWidth="1.6" />
      <path d="M10 16V8h3.2a2.3 2.3 0 010 4.6H10" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function SlidersIcon({ size = 16, color = "currentColor" }) {
  return <MaskIcon src={filterIconImg} size={size} color={color} />;
}
function ClockIcon({ size = 16, color = "currentColor" }) {
  return <MaskIcon src={openNowIconImg} size={size} color={color} />;
}
function ChairIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 4v9a2 2 0 002 2h8a2 2 0 002-2V4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 8.5h12" stroke={color} strokeWidth="1.6" />
      <path d="M8 15v5M16 15v5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function PhoneIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 4h3.3l1.4 3.8-1.9 1.5a11.5 11.5 0 005.9 5.9l1.5-1.9 3.8 1.4V18a2 2 0 01-2 2C10.7 20 4 13.3 4 6a2 2 0 011-2z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function PhotoPlaceholderIcon({ size = 40, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke={color} strokeWidth="1.5" />
      <circle cx="8.5" cy="9.5" r="1.6" stroke={color} strokeWidth="1.5" />
      <path d="M3.5 16.5l5-5 3.5 3.5 3-3 5.5 5.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CuteIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 20s-7-4.4-9.5-9C.9 7.8 2.4 4.8 5.4 4.2c1.9-.4 3.8.5 5 2 1.2-1.5 3.1-2.4 5-2 3 .6 4.5 3.6 2.9 6.8C19 15.6 12 20 12 20z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SearchIcon({ size = 16, color = "currentColor" }) {
  return <MaskIcon src={searchIconImg} size={size} color={color} />;
}
function PinIcon({ size = 30, filled, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 38" fill="none">
      <ellipse cx="15" cy="36.5" rx="6.5" ry="2" fill="rgba(38,36,31,0.22)" />
      <path
        d="M15 1C7.8 1 2 6.8 2 14c0 9.6 11.3 21.6 12 22.3.5.5 1.2.5 1.8 0C16.6 35.6 28 23.6 28 14 28 6.8 22.2 1 15 1z"
        fill={color}
      />
      <circle cx="15" cy="14" r="6.2" fill="#FFFDF8" stroke={filled ? color : "none"} strokeWidth="1" />
      <g fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="14.5" cy="17.6" rx="4.3" ry="0.75" />
        <path d="M11 12h7v2.2a3.2 3.2 0 01-3.2 3.2h-0.6A3.2 3.2 0 0111 14.2V12z" />
        <path d="M18 12.8h1a1.3 1.3 0 010 2.6h-1" />
        <path d="M13 10.6c0-.6-.6-.6-.6-1.2M14.8 10.6c0-.6-.6-.6-.6-1.2" />
      </g>
    </svg>
  );
}
/* 선택된 핀 - map-pin-cafe-selected.png(빨간 네온 글로우 + 체크 배지)을 그대로 얹는다. */
function SelectedPinIcon({ size = 96, x = 0, y = 0 }) {
  return <image href={pinCafeSelectedImg} x={x} y={y} width={size} height={size} />;
}
function pinDataUrl(color, filled) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
    <ellipse cx="15" cy="36.5" rx="6.5" ry="2" fill="rgba(38,36,31,0.22)"/>
    <path d="M15 1C7.8 1 2 6.8 2 14c0 9.6 11.3 21.6 12 22.3.5.5 1.2.5 1.8 0C16.6 35.6 28 23.6 28 14 28 6.8 22.2 1 15 1z" fill="${color}"/>
    <circle cx="15" cy="14" r="6.2" fill="#FFFDF8" stroke="${filled ? color : "none"}" stroke-width="1"/>
    <g fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="14.5" cy="17.6" rx="4.3" ry="0.75"/>
      <path d="M11 12h7v2.2a3.2 3.2 0 01-3.2 3.2h-0.6A3.2 3.2 0 0111 14.2V12z"/>
      <path d="M18 12.8h1a1.3 1.3 0 010 2.6h-1"/>
      <path d="M13 10.6c0-.6-.6-.6-.6-1.2M14.8 10.6c0-.6-.6-.6-.6-1.2"/>
    </g>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}
/* 핀 PNG(둘 다 1254x1254) 안에서 핀 끝(지도 좌표를 가리키는 점)의 비율 위치 */
const PIN_IMG_TIP_RATIO = { x: 0.496, y: 0.8327 };
const PIN_IMG_SELECTED_TIP_RATIO = { x: 0.493, y: 0.842 };
function pinIconSpec(isSelected, isHovered) {
  if (isSelected) {
    const size = 88;
    return {
      url: pinCafeSelectedImg,
      w: size,
      h: size,
      scaleW: size,
      scaleH: size,
      anchorX: Math.round(size * PIN_IMG_SELECTED_TIP_RATIO.x),
      anchorY: Math.round(size * PIN_IMG_SELECTED_TIP_RATIO.y),
    };
  }
  const size = isHovered ? 72 : 62;
  return {
    url: pinCafeImg,
    w: size,
    h: size,
    scaleW: size,
    scaleH: size,
    anchorX: Math.round(size * PIN_IMG_TIP_RATIO.x),
    anchorY: Math.round(size * PIN_IMG_TIP_RATIO.y),
  };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

/* 네이버 지도 핀 아이콘 (이미지) */
function pinImageIcon(naver, spec) {
  return {
    url: spec.url,
    size: new naver.maps.Size(spec.w, spec.h),
    scaledSize: new naver.maps.Size(spec.scaleW, spec.scaleH),
    anchor: new naver.maps.Point(spec.anchorX, spec.anchorY),
  };
}

/* 핀 바로 밑에 붙는 카페 이름 라벨 (별도 마커 - content 아이콘이라 잘리지 않음) */
function labelIcon(naver, name) {
  return {
    content:
      `<div style="display:inline-block;transform:translateX(-50%);white-space:nowrap;` +
      `font:600 12px/1.15 'Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif;` +
      `color:#26241F;text-shadow:0 0 3px #FFFDF8,0 0 3px #FFFDF8,0 1px 2px rgba(255,253,248,0.95);">` +
      `${escapeHtml(name)}</div>`,
    anchor: new naver.maps.Point(0, -6),
  };
}

/* ---------- 네이버 지도 스크립트 로더 ---------- */
function useNaverMapsScript(clientId) {
  const [status, setStatus] = useState(clientId ? "loading" : "unavailable");
  useEffect(() => {
    if (!clientId) {
      setStatus("unavailable");
      return;
    }
    try {
      if (window.naver && window.naver.maps) {
        setStatus("ready");
        return;
      }
      const timeoutId = setTimeout(() => {
        setStatus((s) => (s === "loading" ? "error" : s));
      }, 6000);

      const existing = document.getElementById("naver-maps-sdk");
      if (existing) {
        existing.addEventListener("load", () => { clearTimeout(timeoutId); setStatus("ready"); });
        existing.addEventListener("error", () => { clearTimeout(timeoutId); setStatus("error"); });
        return () => clearTimeout(timeoutId);
      }
      const script = document.createElement("script");
      script.id = "naver-maps-sdk";
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`;
      script.async = true;
      script.onload = () => { clearTimeout(timeoutId); setStatus("ready"); };
      script.onerror = () => { clearTimeout(timeoutId); setStatus("error"); };
      document.head.appendChild(script);
      return () => clearTimeout(timeoutId);
    } catch (e) {
      setStatus("error");
    }
  }, [clientId]);
  return status; // "unavailable" | "loading" | "ready" | "error"
}

/* ---------- 다음(카카오) 우편번호 서비스 스크립트 로더 - 주소 검색 팝업용, API 키 불필요 ---------- */
function useDaumPostcodeScript() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.daum && window.daum.Postcode) {
      setReady(true);
      return;
    }
    const existing = document.getElementById("daum-postcode-sdk");
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }
    const script = document.createElement("script");
    script.id = "daum-postcode-sdk";
    script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => console.error("주소 검색 스크립트 로드 실패");
    document.head.appendChild(script);
  }, []);
  return ready;
}

/* ---------- Supabase 로그인 상태 ---------- */
function useAuth() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback((provider) => {
    if (!supabase) return Promise.resolve({ error: new Error("로그인이 설정되지 않았습니다.") });
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
  }, []);

  const signOut = useCallback(() => supabase?.auth.signOut(), []);

  return { user, authReady, signIn, signOut };
}

/* ---------- 즐겨찾기 (로그인 계정에 저장) ---------- */
function useFavorites(user) {
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());

  useEffect(() => {
    if (!supabase || !user) {
      setFavoriteIds(new Set());
      return;
    }
    let active = true;
    supabase
      .from("favorites")
      .select("cafe_id")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn("즐겨찾기 불러오기 실패:", error.message);
          return;
        }
        setFavoriteIds(new Set((data || []).map((row) => Number(row.cafe_id))));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const toggleFavorite = useCallback(
    async (cafeId) => {
      if (!supabase || !user) return;
      const id = Number(cafeId);
      const wasFavorite = favoriteIds.has(id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        wasFavorite ? next.delete(id) : next.add(id);
        return next;
      });
      const { error } = wasFavorite
        ? await supabase.from("favorites").delete().match({ user_id: user.id, cafe_id: id })
        : await supabase.from("favorites").insert({ user_id: user.id, cafe_id: id });
      if (error) {
        console.warn("즐겨찾기 저장 실패:", error.message);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          wasFavorite ? next.add(id) : next.delete(id);
          return next;
        });
      }
    },
    [user, favoriteIds]
  );

  return { favoriteIds, toggleFavorite };
}

/* 네이버 지오코딩 - 주소 문자열을 좌표로 변환 (submodules=geocoder 필요) */
function geocodeAddressResults(query, callback) {
  if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
    callback(null);
    return;
  }
  try {
    window.naver.maps.Service.geocode({ query: address }, (status, response) => {
      if (status !== window.naver.maps.Service.Status.OK) {
        callback(null);
        return;
      }
      const items = response.v2.addresses;
      if (!items || items.length === 0) {
        callback(null);
        return;
      }
      callback(items.map((item) => ({
        lat: Number(item.y),
        lng: Number(item.x),
        address: item.roadAddress || item.jibunAddress || item.address || query,
        roadAddress: item.roadAddress,
        jibunAddress: item.jibunAddress,
      })));
    });
  } catch (e) {
    console.error("지오코딩 실패:", e);
    callback(null);
  }
}

function geocodeAddress(address, callback) {
  geocodeAddressResults(address, (results) => callback(results && results[0]));
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

function useGlobalErrorCapture() {
  const [error, setError] = useState(null);
  useEffect(() => {
    const onError = (e) => {
      console.error("전역 에러 포착:", e.error || e.message);
      setError(e.error instanceof Error ? e.error : new Error(String(e.message || "알 수 없는 오류")));
    };
    const onRejection = (e) => {
      console.error("처리되지 않은 Promise 거부:", e.reason);
      setError(e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return error;
}

function ErrorFallback({ error }) {
  return (
    <div style={{ fontFamily: "sans-serif", padding: 24, background: "#FBEAE5", color: "#7A2E1F", minHeight: "100vh" }}>
      <h2 style={{ marginTop: 0 }}>화면 렌더링 중 오류가 발생했어요</h2>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "#FFFDF8", padding: 12, borderRadius: 8 }}>
        {String(error && error.message ? error.message : error)}
      </pre>
      <p style={{ fontSize: 12.5 }}>이 메시지를 그대로 알려주시면 바로 고칠게요.</p>
    </div>
  );
}

/* ---------- 에러 바운더리 (React 렌더링 중 오류를 흰 화면 대신 표시) ---------- */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

/* ---------- 메인 컴포넌트 ---------- */
function CafeFinderInner() {
  const [cafes, setCafes] = useState(INITIAL_CAFES);
  const [active, setActive] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [detailCafeId, setDetailCafeId] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pickedLoc, setPickedLoc] = useState(null); // {lat,lng} 지도 클릭으로 지정
  const cardRefs = useRef({});
  const listScrollRef = useRef(null);
  const savedListScrollRef = useRef(0);
  const filterBarRef = useRef(null);
  const filterDragRef = useRef({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const overlayRef = useRef(null);
  const [overlayHeight, setOverlayHeight] = useState(168);
  const [mobileTab, setMobileTab] = useState("map");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [outletRangeFilter, setOutletRangeFilter] = useState(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [mapNoticeDismissed, setMapNoticeDismissed] = useState(false);
  const [mapViewport, setMapViewport] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const mapStatus = useNaverMapsScript(NAVER_CONFIG.clientId);
  const { user, signIn, signOut } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavorites(user);

  const requireLogin = () => setShowLogin(true);

  // 로그인이 풀리면 즐겨찾기 전용 보기도 해제
  useEffect(() => {
    if (!user) setFavoritesOnly(false);
  }, [user]);

  // 테스트 단계: DB/백엔드 없이 브라우저 localStorage에만 저장한다.
  // 백엔드 구성 후에는 이 블록을 /api 호출로 교체하면 된다.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CAFES_STORAGE_KEY) || "null");
      if (Array.isArray(saved) && saved.length) setCafes(saved);
    } catch (error) {
      console.warn("저장된 카페를 불러오지 못했습니다.", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CAFES_STORAGE_KEY, JSON.stringify(cafes));
    } catch (error) {
      console.warn("카페를 저장하지 못했습니다.", error);
    }
  }, [cafes]);

  const toggleFilter = (key) => {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleOutletRangeFilter = (range) => {
    setOutletRangeFilter((current) => current === range ? null : range);
  };

  const hiddenFiltersActive = active.has("cute") || active.has("parking") || !!outletRangeFilter;

  const handleFilterMouseDown = (event) => {
    if (event.button !== 0 || !filterBarRef.current) return;
    filterDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: filterBarRef.current.scrollLeft,
      moved: false,
    };
  };

  const handleFilterMouseMove = (event) => {
    const drag = filterDragRef.current;
    if (!drag.active || !filterBarRef.current) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) drag.moved = true;
    filterBarRef.current.scrollLeft = drag.startScrollLeft - distance;
  };

  const handleFilterMouseUp = () => {
    filterDragRef.current.active = false;
  };

  const handleFilterClick = (event) => {
    if (!filterDragRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    filterDragRef.current.moved = false;
  };

  const filtered = useMemo(() => {
    let list = cafes;
    if (active.size > 0) {
      list = list.filter((c) => [...active].every((k) => c.tags[k]));
    }
    if (outletRangeFilter) {
      list = list.filter((c) => outletRangeFilter === "any"
        ? c.tags.outlet
        : c.outletRange === outletRangeFilter);
    }
    if (openNowOnly) {
      list = list.filter((c) => isOpenNow(c.hours) === true);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.name, c.dong, c.address, c.desc].some((v) => v.toLowerCase().includes(q))
      );
    }
    if (favoritesOnly) {
      list = list.filter((c) => favoriteIds.has(Number(c.id)));
    }
    return list;
  }, [active, cafes, query, openNowOnly, outletRangeFilter, favoritesOnly, favoriteIds]);

  const mapCafes = useMemo(() => {
    // 즐겨찾기 보기일 땐 흩어져 있어도 다 보이도록 뷰포트 필터를 건너뛴다.
    if (favoritesOnly || !mapViewport) return filtered;
    return filtered.filter((cafe) => cafeInViewport(cafe, mapViewport));
  }, [filtered, mapViewport, favoritesOnly]);

  const handleMapViewportChange = useCallback((viewport) => {
    setMapViewport(viewport);
  }, []);

  // 목록 div 자체(overflowY:auto)는 내용이 실제로는 넘치지 않아 항상
  // scrollTop 0이고, 실제 스크롤은 페이지(window/html)에서 일어난다 -
  // 그래서 el.scrollTop만 저장/복원해서는 계속 안 먹혔다. 목록 div가
  // 실제로 넘치는 경우(예: 더 큰 화면)엔 그쪽을, 아니면 window를 쓴다.
  const isListElementScrollable = () => {
    const el = listScrollRef.current;
    return el && el.scrollHeight > el.clientHeight;
  };
  const getListScrollPosition = () => (
    isListElementScrollable() ? listScrollRef.current.scrollTop : window.scrollY
  );
  const setListScrollPosition = (value) => {
    if (isListElementScrollable()) {
      listScrollRef.current.scrollTop = value;
    } else {
      window.scrollTo(0, value);
    }
  };

  // 지도 보고 목록으로 돌아왔을 때 스크롤이 맨 위로 리셋되지 않도록
  // 마지막으로 있던 위치를 복원한다. useLayoutEffect로 화면에 그려지기
  // 전에 동기적으로 우선 적용하고, 그 즉시 적용이 무시되는 기기가 있어
  // rAF로 한 번 더(그래도 밀리면 다음 rAF에서 한 번 더) 재적용한다.
  useLayoutEffect(() => {
    if (mobileTab !== "list") return;
    const target = savedListScrollRef.current;
    setListScrollPosition(target);
    let raf1 = requestAnimationFrame(() => {
      setListScrollPosition(target);
      raf1 = requestAnimationFrame(() => {
        setListScrollPosition(target);
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, [mobileTab]);

  // 검색창/필터/탭이 지도 위에 떠 있는 오버레이라 목록 첫 카드가
  // 가려지지 않도록, 오버레이 실제 높이를 재서 목록 상단 여백으로 준다.
  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setOverlayHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const selectCafe = (id) => {
    setSelected(id);
    setDetailCafeId(id);
  };

  const showCafeOnMap = (id) => {
    savedListScrollRef.current = getListScrollPosition();
    setSelected(id);
    setMobileTab("map");
  };

  const handleMapClickForForm = useCallback((lat, lng) => {
    setPickedLoc({ lat, lng });
  }, []);

  const submitCafe = async (data) => {
    const loc = pickedLoc || { lat: 37.5535, lng: 126.914 }; // 위치 미지정 시 동네 중앙 기본값
    const newCafe = {
      id: Date.now(),
      name: data.name,
      dong: data.dong || inferDong(data.address),
      address: data.address,
      tags: data.tags,
      outletRange: data.outletRange,
      naverName: data.naverName,
      naverLink: data.naverLink,
      phone: data.phone,
      seats: Number(data.seats) || 0,
      rating: 0,
      hours: weeklyHoursSummary(data.weeklyHours) || "정보 없음",
      weeklyHours: data.weeklyHours,
      desc: data.desc,
      lat: loc.lat,
      lng: loc.lng,
    };
    // 테스트 단계: state에만 추가하면 localStorage 저장 effect가 이어서 처리한다.
    setCafes((prev) => [newCafe, ...prev]);
    selectCafe(newCafe.id);
    setShowForm(false);
    setPickedLoc(null);
  };

  const addReview = async (cafeId, review) => {
    const savedReview = {
      id: review.id ?? Date.now(),
      rating: Number(review.rating) || 0,
      text: (review.text || "").trim(),
      images: review.images || [],
      createdAt: review.createdAt || new Date().toLocaleDateString("ko-KR"),
    };
    setCafes((prev) => prev.map((cafe) => cafe.id === cafeId
      ? { ...cafe, reviews: [savedReview, ...(cafe.reviews || [])] }
      : cafe));
  };

  const selectedCafe = cafes.find((c) => c.id === selected) || null;
  const detailCafe = cafes.find((c) => c.id === detailCafeId) || null;

  return (
    <div style={styles.appOuter}>
      <div style={styles.appShell}>
      <style>{FONT_IMPORT}</style>

      <div style={styles.mainMobile}>
        <div
          ref={listScrollRef}
          style={{ ...styles.listPaneMobile, paddingTop: overlayHeight + 12, display: mobileTab === "list" ? "flex" : "none" }}
        >
            {filtered.length === 0 && (
              <div style={styles.emptyState}>
                {favoritesOnly
                  ? "즐겨찾기한 카페가 없어요. 상세보기에서 별표를 눌러 추가해보세요."
                  : query
                  ? `'${query}'에 맞는 카페가 없어요.`
                  : "조건에 맞는 카페가 없어요. 필터를 줄여보세요."}
              </div>
            )}
            {filtered.map((c) => (
              <div
                key={c.id}
                ref={(el) => (cardRefs.current[c.id] = el)}
                onClick={() => showCafeOnMap(c.id)}
                className="cf-card"
                style={{ ...styles.card, ...(selected === c.id ? styles.cardSelected : {}) }}
              >
                <div style={styles.cardTop}>
                  <div>
                    <h3 style={styles.cardTitle}>{c.name}</h3>
                    <p style={styles.cardDong}>{c.dong} · {c.address}</p>
                  </div>
                  <div style={styles.rating}>{c.rating > 0 ? `★ ${c.rating}` : "신규 등록"}</div>
                </div>
                <p style={styles.cardDesc}>{c.desc}</p>
                <div style={styles.badgeRow}>
                  {FILTERS.filter((f) => c.tags[f.key]).map(({ key, label, icon: Icon }) => (
                    <span key={key} style={styles.badge}>
                      <Icon size={12} color="#3D6B5F" />
                      {key === "outlet" ? outletRangeLabel(c) : label}
                    </span>
                  ))}
                </div>
                <div style={styles.cardMeta}>
                  좌석 {c.seats}석 · {c.hours}
                  {isOpenNow(c.hours, c.weeklyHours) !== null && (
                    <span style={isOpenNow(c.hours, c.weeklyHours) ? styles.openBadge : styles.closedBadge}>
                      {isOpenNow(c.hours, c.weeklyHours) ? "영업중" : "영업종료"}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>

        <div style={{ ...styles.mapPaneMobile, display: mobileTab === "map" ? "block" : "none" }}>
          {mapStatus === "ready" ? (
            <NaverRealMap
              cafes={mapCafes}
              allCafes={filtered}
              selected={selected}
              hovered={hovered}
              onSelect={selectCafe}
              onHover={setHovered}
              pickMode={showForm}
              onPick={handleMapClickForForm}
              pickedLoc={pickedLoc}
              onViewportChange={handleMapViewportChange}
            />
          ) : (
            <MockMapView
              cafes={mapCafes}
              selected={selected}
              hovered={hovered}
              onSelect={selectCafe}
              onHover={setHovered}
              pickMode={showForm}
              onPick={handleMapClickForForm}
              pickedLoc={pickedLoc}
              onViewportChange={handleMapViewportChange}
            />
          )}
        </div>

        <div ref={overlayRef} style={styles.overlayControls}>
          <div style={styles.searchBar}>
            <SearchIcon size={18} color={COLOR.inkSoft} />
            <input
              style={styles.searchInput}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setActive(new Set());
                  setOpenNowOnly(false);
                  setOutletRangeFilter(null);
                  setQuery(queryInput.trim());
                }
              }}
              placeholder="카페 이름, 동네로 검색"
            />
            {!queryInput && (
              <span style={styles.searchLogo} aria-hidden="true">
                <img src={logoCupImg} alt="" style={styles.searchLogoIcon} />
                카페찾기
              </span>
            )}
            {queryInput && (
              <button
                style={styles.searchClearBtn}
                onClick={() => { setQueryInput(""); setQuery(""); }}
                aria-label="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>

          <div style={styles.filterBarWrap}>
            <div
              ref={filterBarRef}
              style={styles.filterBar}
              className="cf-filterbar"
              onMouseDown={handleFilterMouseDown}
              onMouseMove={handleFilterMouseMove}
              onMouseUp={handleFilterMouseUp}
              onMouseLeave={handleFilterMouseUp}
              onClick={handleFilterClick}
            >
              <button
                onClick={() => setOpenNowOnly((v) => !v)}
                style={{ ...styles.filterChip, ...(openNowOnly ? styles.filterChipActive : {}) }}
              >
                <ClockIcon size={15} color={openNowOnly ? "#FFFDF8" : "#5B5648"} />
                지금 영업중
              </button>
              {FILTERS.filter(({ key }) => key === "large" || key === "interior").map(({ key, label, icon: Icon }) => {
                const isActive = active.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleFilter(key)}
                    style={{ ...styles.filterChip, ...(isActive ? styles.filterChipActive : {}) }}
                  >
                    <Icon size={15} color={isActive ? "#FFFDF8" : "#5B5648"} />
                    {label}
                  </button>
                );
              })}
              <button
                onClick={() => setShowFilterPanel((value) => !value)}
                style={{ ...styles.filterSettingsChip, ...(hiddenFiltersActive ? styles.filterChipActive : {}) }}
                aria-expanded={showFilterPanel}
                aria-label="필터 설정"
              >
                <SlidersIcon size={16} color={hiddenFiltersActive ? "#FFFDF8" : "#5B5648"} />
              </button>
            </div>
            {showFilterPanel && (
              <div style={styles.filterFullMenu}>
                <div style={styles.filterFullMenuHeader}>
                  <strong>필터</strong>
                  <button type="button" style={styles.filterFullMenuClose} onClick={() => setShowFilterPanel(false)} aria-label="필터 패널 닫기">✕</button>
                </div>
                <div style={styles.filterFullMenuGrid}>
                  <button
                    onClick={() => setOpenNowOnly((v) => !v)}
                    style={{ ...styles.filterChip, ...(openNowOnly ? styles.filterChipActive : {}) }}
                  >
                    <ClockIcon size={15} color={openNowOnly ? "#FFFDF8" : "#5B5648"} />
                    지금 영업중
                  </button>
                  {FILTERS.filter(({ key }) => key !== "outlet").map(({ key, label, icon: Icon }) => {
                    const isActive = active.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleFilter(key)}
                        style={{ ...styles.filterChip, ...(isActive ? styles.filterChipActive : {}) }}
                      >
                        <Icon size={15} color={isActive ? "#FFFDF8" : "#5B5648"} />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <strong style={styles.outletFilterTitle}>콘센트 있는 좌석 수</strong>
                <div style={styles.outletFilterOptions}>
                  <button type="button" style={{ ...styles.outletFilterOption, ...(outletRangeFilter === "any" ? styles.outletFilterOptionActive : {}) }} onClick={() => toggleOutletRangeFilter("any")}>전체</button>
                  {OUTLET_RANGES.filter(({ value }) => !["none", "unknown"].includes(value)).map(({ value, label }) => (
                    <button key={value} type="button" style={{ ...styles.outletFilterOption, ...(outletRangeFilter === value ? styles.outletFilterOptionActive : {}) }} onClick={() => toggleOutletRangeFilter(value)}>{label}</button>
                  ))}
                </div>
                {(active.size > 0 || openNowOnly || outletRangeFilter) && (
                  <button
                    onClick={() => { setActive(new Set()); setOpenNowOnly(false); setOutletRangeFilter(null); }}
                    style={styles.filterFullMenuReset}
                  >
                    초기화
                  </button>
                )}
              </div>
            )}
            <div style={styles.filterBarFade} />
          </div>

          {mapStatus !== "ready" && !mapNoticeDismissed && (
            <div style={styles.mapNotice}>
              <span aria-hidden="true" style={styles.mapNoticeIcon}>ⓘ</span>
              <span style={styles.mapNoticeText}>
                {NAVER_CONFIG.clientId
                  ? "네이버 지도를 불러오는 중이거나 연결에 실패했어요."
                  : "네이버 지도 Client ID가 설정되지 않아 목업 지도로 표시 중이에요."}
              </span>
              <button
                type="button"
                style={styles.mapNoticeClose}
                onClick={() => setMapNoticeDismissed(true)}
                aria-label="안내 닫기"
              >
                ✕
              </button>
            </div>
          )}

          <div style={styles.mobileTabBar}>
            <button
              style={{ ...styles.mobileTabBtn, ...(mobileTab === "map" ? styles.mobileTabBtnActive : {}) }}
              onClick={() => setMobileTab("map")}
            >
              <MaskIcon src={mapIconImg} size={15} color={mobileTab === "map" ? "#FFFDF8" : COLOR.ink} />
              지도
            </button>
            <button
              style={{ ...styles.mobileTabBtn, ...(mobileTab === "list" ? styles.mobileTabBtnActive : {}) }}
              onClick={() => setMobileTab("list")}
            >
              <MaskIcon src={listIconImg} size={15} color={mobileTab === "list" ? "#FFFDF8" : COLOR.ink} />
              목록 ({filtered.length})
            </button>
          </div>
        </div>

        {mobileTab === "map" && user && (
          <button
            type="button"
            style={styles.accountBtn}
            onClick={() => { if (window.confirm("로그아웃 할까요?")) signOut(); }}
            aria-label="로그아웃"
            title={user.email || "로그인됨"}
          >
            {(user.email || user.user_metadata?.name || "?").trim().charAt(0).toUpperCase()}
          </button>
        )}

        {mobileTab === "map" && (
          <button
            type="button"
            style={{ ...styles.favoritesToggleBtn, ...(favoritesOnly ? styles.favoritesToggleBtnActive : {}) }}
            onClick={() => {
              if (!user) { requireLogin(); return; }
              setFavoritesOnly((v) => !v);
            }}
            aria-pressed={favoritesOnly}
            aria-label="즐겨찾기한 카페만 보기"
          >
            <span style={styles.favoritesToggleStar}>{favoritesOnly ? "★" : "☆"}</span>
            <span style={styles.favoritesToggleLabel}>즐겨찾기</span>
          </button>
        )}

        <button style={styles.addBtnFloating} onClick={() => { setPickedLoc(null); setShowForm(true); }}>
          <img src={registerIconImg} alt="" aria-hidden="true" style={styles.addBtnIcon} />
          <span style={styles.addBtnLabel}>카페 등록</span>
        </button>
      </div>

      {detailCafe && (
        <CafeDetailModal
          cafe={detailCafe}
          onClose={() => setDetailCafeId(null)}
          onAddReview={addReview}
          isLoggedIn={!!user}
          isFavorite={favoriteIds.has(Number(detailCafe.id))}
          onToggleFavorite={toggleFavorite}
          onRequireLogin={requireLogin}
        />
      )}

      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onSignIn={signIn} />
      )}

      {showForm && (
        <CafeForm
          pickedLoc={pickedLoc}
          onCancel={() => { setShowForm(false); setPickedLoc(null); }}
          onSubmit={submitCafe}
          mapStatus={mapStatus}
          onSetLoc={(loc) => setPickedLoc(loc)}
        />
      )}
      </div>
    </div>
  );
}

/* ---------- SNS 로그인 팝업 (카카오 / 구글) ---------- */
function LoginModal({ onClose, onSignIn, reason }) {
  const [busy, setBusy] = useState(null);
  const handle = async (provider) => {
    setBusy(provider);
    const { error } = (await onSignIn(provider)) || {};
    if (error) {
      setBusy(null);
      alert(error.message || "로그인을 시작할 수 없습니다.");
    }
    // 성공 시 OAuth 페이지로 리다이렉트되므로 여기서 별도 처리 없음
  };
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.loginModal} onClick={(event) => event.stopPropagation()}>
        <button type="button" style={styles.detailCloseBtn} onClick={onClose} aria-label="닫기">×</button>
        <h2 style={styles.loginTitle}>로그인</h2>
        <p style={styles.loginDesc}>{reason || "로그인하면 즐겨찾기가 계정에 저장됩니다."}</p>
        {isSupabaseConfigured ? (
          <>
            <button type="button" style={{ ...styles.snsBtn, ...styles.kakaoBtn }} disabled={!!busy} onClick={() => handle("kakao")}>
              {busy === "kakao" ? "이동 중..." : "카카오로 계속하기"}
            </button>
            <button type="button" style={{ ...styles.snsBtn, ...styles.googleBtn }} disabled={!!busy} onClick={() => handle("google")}>
              {busy === "google" ? "이동 중..." : "Google로 계속하기"}
            </button>
            <p style={styles.loginFinePrint}>처음이면 자동으로 가입됩니다.</p>
          </>
        ) : (
          <p style={styles.loginFinePrint}>
            로그인이 아직 설정되지 않았습니다. <code>docs/auth-setup.md</code> 를 참고해 Supabase 키를 등록해주세요.
          </p>
        )}
      </div>
    </div>
  );
}

function CafeDetailModal({ cafe, onClose, onAddReview, isFavorite, isLoggedIn, onToggleFavorite, onRequireLogin }) {
  const openState = isOpenNow(cafe.hours, cafe.weeklyHours);
  const naverMapUrl = `https://map.naver.com/v5/?c=${cafe.lng},${cafe.lat},15,0,0,0,dh`;
  const reviewPhotoList = (cafe.reviews || []).flatMap((review) => review.images || []);
  const detailModalRef = useRef(null);
  const detailDragRef = useRef({ startY: 0, dragging: false });
  const [detailDragOffset, setDetailDragOffset] = useState(0);

  // 아래로 끌어서 닫기 - 모달이 맨 위로 스크롤돼 있을 때만 시작하고,
  // 브라우저의 당겨서 새로고침(pull-to-refresh)과 충돌하지 않도록
  // 드래그 중엔 preventDefault로 막는다. React의 onTouchMove는 기본
  // passive라 preventDefault가 안 먹어서 네이티브 리스너로 직접 붙인다.
  useEffect(() => {
    const el = detailModalRef.current;
    if (!el) return;
    const onTouchStart = (event) => {
      if (el.scrollTop > 0) {
        detailDragRef.current.dragging = false;
        return;
      }
      detailDragRef.current = { startY: event.touches[0].clientY, dragging: true };
    };
    const onTouchMove = (event) => {
      if (!detailDragRef.current.dragging) return;
      const dy = event.touches[0].clientY - detailDragRef.current.startY;
      if (dy > 0) {
        event.preventDefault();
        setDetailDragOffset(dy);
      } else {
        detailDragRef.current.dragging = false;
        setDetailDragOffset(0);
      }
    };
    const onTouchEnd = () => {
      if (!detailDragRef.current.dragging) return;
      detailDragRef.current.dragging = false;
      setDetailDragOffset((current) => {
        if (current > 90) {
          onClose();
        }
        return 0;
      });
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onClose]);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewImages, setReviewImages] = useState([]);
  const [showReviewComposer, setShowReviewComposer] = useState(false);
  const [composerMode, setComposerMode] = useState("review");
  const [detailTab, setDetailTab] = useState("photos");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const photoViewerRef = useRef(null);
  const photoDragRef = useRef({ startX: 0, startY: 0, mode: null });
  const swipedRef = useRef(false);
  const [photoDragOffset, setPhotoDragOffset] = useState(0);

  // 좌우로 쓸면 사진 넘기기, 아래로 쓸면 닫기 - 둘 다 같은 제스처 영역을
  // 쓰므로 첫 움직임의 방향으로 모드를 한 번 고정한다. 아래로 끌 때는
  // 브라우저의 당겨서 새로고침과 충돌하지 않도록 preventDefault가 필요해서
  // (React의 onTouchMove는 기본 passive라 안 먹는다) 네이티브로 붙인다.
  useEffect(() => {
    const el = photoViewerRef.current;
    if (!el) return;
    const onTouchStart = (event) => {
      const t = event.touches[0];
      photoDragRef.current = { startX: t.clientX, startY: t.clientY, mode: null };
      swipedRef.current = false;
    };
    const onTouchMove = (event) => {
      const t = event.touches[0];
      const dx = t.clientX - photoDragRef.current.startX;
      const dy = t.clientY - photoDragRef.current.startY;
      if (!photoDragRef.current.mode && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        photoDragRef.current.mode = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      // 화면 위쪽에서 시작한 드래그는 브라우저가 당겨서 새로고침을 훨씬
      // 빨리(=10px 잠금 임계값 넘기 전에) 감지해버려서, 모드가 "vertical"로
      // 확정되길 기다렸다가 막으면 이미 늦는다. 아직 방향이 안 정해졌어도
      // 아래로 움직이는 중이면(가로보다 세로가 크거나 같으면) 곧바로 막는다.
      if (!photoDragRef.current.mode && dy > 0 && dy >= Math.abs(dx)) {
        event.preventDefault();
        return;
      }
      if (photoDragRef.current.mode === "horizontal") {
        swipedRef.current = true;
      } else if (photoDragRef.current.mode === "vertical") {
        if (dy > 0) {
          event.preventDefault();
          swipedRef.current = true;
          setPhotoDragOffset(dy);
        } else {
          photoDragRef.current.mode = null;
          setPhotoDragOffset(0);
        }
      }
    };
    const onTouchEnd = (event) => {
      const mode = photoDragRef.current.mode;
      if (mode === "horizontal" && reviewPhotoList.length > 1) {
        const t = event.changedTouches[0];
        const dx = t.clientX - photoDragRef.current.startX;
        if (Math.abs(dx) > 40) {
          setSelectedPhotoIndex((current) => (
            dx < 0 ? (current + 1) % reviewPhotoList.length : (current - 1 + reviewPhotoList.length) % reviewPhotoList.length
          ));
        }
      } else if (mode === "vertical") {
        setPhotoDragOffset((current) => {
          if (current > 90) setSelectedPhotoIndex(null);
          return 0;
        });
      }
      photoDragRef.current.mode = null;
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [selectedPhotoIndex !== null, reviewPhotoList.length]);

  const handleReviewImages = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 5);
    setReviewImages(files.map((file) => ({ file, url: URL.createObjectURL(file) })));
    setReviewSubmitError("");
  };

  // 휴대폰 카메라 원본 사진은 수 MB로 커서 FileReader.readAsDataURL이 간헐적으로
  // 실패하고 localStorage 용량도 금방 차므로, 캔버스로 축소·압축한 뒤 저장한다.
  const fileToCompressedDataUrl = (file, maxDimension = 1440, quality = 0.82) => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`이미지를 불러오지 못했습니다: ${file.name}`));
    };
    img.src = objectUrl;
  });

  const submitReview = async () => {
    if (!reviewText.trim() && reviewImages.length === 0) return;
    setSubmittingReview(true);
    setReviewSubmitError("");
    try {
      const results = await Promise.allSettled(
        reviewImages.map(({ file, url }) => (file ? fileToCompressedDataUrl(file) : Promise.resolve(url)))
      );
      const imageUrls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      const failedCount = results.length - imageUrls.length;
      if (imageUrls.length === 0 && failedCount > 0) {
        throw new Error("사진을 처리하지 못했습니다. 다른 사진으로 시도해주세요.");
      }
      await onAddReview(cafe.id, {
      id: Date.now(),
      rating: reviewRating,
      text: reviewText.trim(),
      images: imageUrls,
      createdAt: new Date().toLocaleDateString("ko-KR"),
      });
      setReviewText("");
      setReviewRating(0);
      setReviewImages([]);
      if (failedCount > 0) {
        // 저장은 됐지만 일부 사진이 빠졌다는 걸 보여줘야 하니 모달을 자동으로 닫지 않는다.
        setReviewSubmitError(`저장은 됐지만 사진 ${failedCount}장은 처리에 실패해 제외했습니다.`);
      } else {
        setShowReviewComposer(false);
      }
    } catch (error) {
      console.error("리뷰 저장 실패:", error);
      setReviewSubmitError(error.message || String(error));
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div style={styles.detailOverlay} onClick={onClose}>
      <div
        ref={detailModalRef}
        style={{
          ...styles.detailModal,
          transform: detailDragOffset ? `translateY(${detailDragOffset}px)` : undefined,
          transition: detailDragOffset ? "none" : "transform 0.2s ease",
          opacity: detailDragOffset ? Math.max(1 - detailDragOffset / 300, 0.5) : 1,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.detailDragHandle} aria-hidden="true" />
        <div style={styles.detailHeader}>
          <div>
            <p style={styles.detailEyebrow}>카페 상세 정보</p>
            <h2 style={styles.detailTitle}>{cafe.name}</h2>
            <p style={styles.detailReviewCount}>리뷰 {cafe.reviews?.length || 0}개</p>
          </div>
          <button type="button" style={styles.detailCloseBtn} onClick={onClose} aria-label="상세 정보 닫기">×</button>
        </div>
        <button
          type="button"
          style={{ ...styles.favoriteBtn, ...(isFavorite ? styles.favoriteBtnActive : {}) }}
          onClick={() => (isLoggedIn ? onToggleFavorite(cafe.id) : onRequireLogin())}
          aria-pressed={isFavorite}
        >
          <span style={styles.favoriteStar}>{isFavorite ? "★" : "☆"}</span>
          {isFavorite ? "즐겨찾기 완료" : "즐겨찾기"}
        </button>
        <p style={styles.detailAddress}>{cafe.dong} · {cafe.address}</p>
        <div style={styles.badgeRow}>
          {FILTERS.filter((filter) => cafe.tags[filter.key]).map(({ key, label, icon: Icon }) => (
        <span key={key} style={styles.badge}><Icon size={12} color="#3D6B5F" />{key === "outlet" ? outletRangeLabel(cafe) : label}</span>
          ))}
        </div>
        <p style={styles.detailDescription}>{cafe.desc || "등록된 소개가 없습니다."}</p>
        <div style={styles.detailInfoGrid}>
          <div style={styles.infoCard}>
            <span style={styles.detailInfoLabel}><ClockIcon size={14} color={COLOR.inkSoft} />영업시간</span>
            <strong style={styles.infoCardValue}>{cafe.hours}</strong>
          </div>
          <div style={styles.infoCard}>
            <span style={styles.detailInfoLabel}>
              <span style={{ ...styles.statusDot, background: openState === null ? COLOR.inkSoft : openState ? COLOR.teal : COLOR.accent }} />
              상태
            </span>
            <strong style={{ ...styles.infoCardValue, ...(openState ? styles.openText : styles.closedText) }}>{openState === null ? "정보 없음" : openState ? "영업중" : "영업종료"}</strong>
          </div>
          <div style={styles.infoCard}>
            <span style={styles.detailInfoLabel}><ChairIcon size={14} color={COLOR.inkSoft} />좌석</span>
            <strong style={styles.infoCardValue}>{cafe.seats}석</strong>
          </div>
          <div style={styles.infoCard}>
            <span style={styles.detailInfoLabel}><PhoneIcon size={14} color={COLOR.inkSoft} />전화번호</span>
            <strong style={styles.infoCardValue}>{cafe.phone || "등록된 번호 없음"}</strong>
          </div>
        </div>
        <a href={naverMapUrl} target="_blank" rel="noreferrer" style={styles.naverMapLink}>네이버 지도에서 보기 ↗</a>
        <section style={styles.reviewSection}>
          <div style={styles.detailTabs} role="tablist" aria-label="카페 상세 정보 탭">
            <button type="button" role="tab" aria-selected={detailTab === "photos"} style={{ ...styles.detailTab, ...(detailTab === "photos" ? styles.detailTabActive : {}) }} onClick={() => setDetailTab("photos")}>
              사진
            </button>
            <button type="button" role="tab" aria-selected={detailTab === "reviews"} style={{ ...styles.detailTab, ...(detailTab === "reviews" ? styles.detailTabActive : {}) }} onClick={() => setDetailTab("reviews")}>
              리뷰
            </button>
          </div>
          {detailTab === "reviews" ? (
            <div>
              <div style={styles.reviewSectionHeader}>
                <h3 style={styles.reviewTitle}>리뷰</h3>
                <button type="button" style={styles.writeReviewBtn} onClick={() => { setComposerMode("review"); setShowReviewComposer(true); }}>리뷰 남기기</button>
              </div>
              {(cafe.reviews || []).length === 0 && <p style={styles.emptyPhotoText}>아직 리뷰가 없습니다.</p>}
              {(cafe.reviews || []).map((review) => (
                <article key={review.id} style={styles.reviewItem}>
                  <div style={styles.reviewItemTop}><span style={styles.reviewStars}>{review.rating ? `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}` : "사진 리뷰"}</span><time style={styles.reviewDate}>{review.createdAt}</time></div>
                  {review.text && <p style={styles.reviewText}>{review.text}</p>}
                  {review.images?.length > 0 && <div style={styles.reviewImageGrid}>{review.images.map((image, index) => <img key={image} src={image} alt={`리뷰 사진 ${index + 1}`} style={styles.reviewImage} />)}</div>}
                </article>
              ))}
            </div>
          ) : (
            <div style={styles.photoGallerySection}>
              <div style={styles.photoGalleryHeader}>
                <h3 style={styles.reviewTitle}>사진</h3>
                <button type="button" style={styles.addPhotoBtn} onClick={() => { setComposerMode("photo"); setShowReviewComposer(true); }} aria-label="사진 추가">+</button>
              </div>
              {reviewPhotoList.length > 0 ? (
                <div style={styles.photoGallery}>{reviewPhotoList.map((image, index) => <button type="button" key={`${image}-${index}`} style={styles.galleryImageButton} onClick={() => setSelectedPhotoIndex(index)}><img src={image} alt={`카페 리뷰 사진 ${index + 1}`} style={styles.galleryImage} /></button>)}</div>
              ) : (
                <div style={styles.emptyPhotoState}>
                  <PhotoPlaceholderIcon size={40} color={COLOR.border} />
                  <p style={styles.emptyPhotoText}>아직 등록된 사진이 없습니다.</p>
                  <button type="button" style={styles.centerUploadBtn} onClick={() => { setComposerMode("photo"); setShowReviewComposer(true); }}>
                    <span style={styles.uploadPlus}>+</span>
                    이미지 업로드
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      {!showReviewComposer && selectedPhotoIndex === null && (
        <button type="button" style={styles.detailFabClose} onClick={onClose} aria-label="상세 정보 닫기">×</button>
      )}
      {showReviewComposer && (
        <div style={styles.reviewOverlay} onClick={() => setShowReviewComposer(false)}>
          <div style={styles.reviewModal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.reviewModalHeader}>
              <h3 style={styles.reviewModalTitle}>{composerMode === "photo" ? "사진 추가" : "리뷰 남기기"}</h3>
              <button type="button" style={styles.reviewModalCloseBtn} onClick={() => setShowReviewComposer(false)} aria-label="리뷰 작성 닫기">×</button>
            </div>
            <p style={styles.reviewModalCafeName}>{cafe.name} · 리뷰는 선택이에요</p>
            {composerMode === "photo" && (
              <>
                <label style={styles.photoAttachBtnLarge}>
                  <span style={styles.uploadPlus}>+</span>
                  사진 첨부하기
                  <input type="file" accept="image/*" multiple onChange={handleReviewImages} style={{ display: "none" }} />
                </label>
                {reviewImages.length > 0 && <div style={styles.reviewImagePreviewRow}>{reviewImages.map(({ url }, index) => <img key={url} src={url} alt={`첨부 사진 ${index + 1}`} style={styles.reviewImagePreview} />)}</div>}
              </>
            )}
            <div style={styles.ratingPicker} aria-label="별점 선택">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button key={rating} type="button" onClick={() => setReviewRating(rating)} style={{ ...styles.starButton, ...(rating <= reviewRating ? styles.starButtonActive : {}) }} aria-label={`${rating}점`}>★</button>
              ))}
            </div>
            <textarea autoFocus={composerMode !== "photo"} style={styles.reviewInput} value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder={composerMode === "photo" ? "리뷰를 남겨보세요 (선택)" : "카페에서의 경험을 남겨주세요 (선택)"} />
            {composerMode !== "photo" && reviewImages.length > 0 && <div style={styles.reviewImagePreviewRow}>{reviewImages.map(({ url }, index) => <img key={url} src={url} alt={`첨부 사진 ${index + 1}`} style={styles.reviewImagePreview} />)}</div>}
            {reviewSubmitError && (
              <div style={{ fontSize: 12, color: "#b3441f", marginTop: 8 }}>{reviewSubmitError}</div>
            )}
            <div style={styles.reviewComposerActions}>
              {composerMode !== "photo" && (
                <label style={styles.photoAttachBtn}>사진 첨부<input type="file" accept="image/*" multiple onChange={handleReviewImages} style={{ display: "none" }} /></label>
              )}
              <button
                type="button"
                style={{ ...styles.reviewSubmitBtn, opacity: (reviewText.trim() || reviewImages.length) && !submittingReview ? 1 : 0.45, marginLeft: composerMode === "photo" ? "auto" : 0 }}
                onClick={submitReview}
                disabled={(!reviewText.trim() && reviewImages.length === 0) || submittingReview}
              >
                {submittingReview ? "저장 중..." : composerMode === "photo" ? "사진 등록" : "리뷰 등록"}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedPhotoIndex !== null && (
        <div
          ref={photoViewerRef}
          style={{
            ...styles.photoViewerOverlay,
            transform: photoDragOffset ? `translateY(${photoDragOffset}px)` : undefined,
            transition: photoDragOffset ? "none" : "transform 0.2s ease",
            opacity: photoDragOffset ? Math.max(1 - photoDragOffset / 300, 0.5) : 1,
          }}
          onClick={() => { if (swipedRef.current) { swipedRef.current = false; return; } setSelectedPhotoIndex(null); }}
        >
          <button type="button" style={styles.photoViewerClose} onClick={() => setSelectedPhotoIndex(null)} aria-label="사진 닫기">×</button>
          {reviewPhotoList.length > 1 && (
            <button type="button" style={{ ...styles.photoViewerNav, ...styles.photoViewerPrev }} onClick={(event) => { event.stopPropagation(); setSelectedPhotoIndex((selectedPhotoIndex - 1 + reviewPhotoList.length) % reviewPhotoList.length); }} aria-label="이전 사진">‹</button>
          )}
          <img src={reviewPhotoList[selectedPhotoIndex]} alt={`카페 리뷰 사진 ${selectedPhotoIndex + 1}`} style={styles.photoViewerImage} onClick={(event) => event.stopPropagation()} />
          {reviewPhotoList.length > 1 && (
            <button type="button" style={{ ...styles.photoViewerNav, ...styles.photoViewerNext }} onClick={(event) => { event.stopPropagation(); setSelectedPhotoIndex((selectedPhotoIndex + 1) % reviewPhotoList.length); }} aria-label="다음 사진">›</button>
          )}
          <span style={styles.photoViewerCount}>{selectedPhotoIndex + 1} / {reviewPhotoList.length}</span>
        </div>
      )}
    </div>
  );
}

export default function CafeFinder() {
  const globalError = useGlobalErrorCapture();
  if (globalError) return <ErrorFallback error={globalError} />;
  return (
    <ErrorBoundary>
      <CafeFinderInner />
    </ErrorBoundary>
  );
}

function TimePicker({ value, onChange, label }) {
  const handleChange = (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
    const nextValue = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    onChange(nextValue);
  };

  return (
    <div style={styles.timePicker} aria-label={label}>
      <input
        style={styles.timeTextInput}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder="09:00"
        maxLength={5}
        aria-label={label}
      />
    </div>
  );
}

/* ---------- 등록 폼 ---------- */
function CafeForm({ pickedLoc, onCancel, onSubmit, mapStatus, onSetLoc }) {
  const [name, setName] = useState("");
  const [naverPlace, setNaverPlace] = useState(null);
  const [address, setAddress] = useState("");
  const [seats, setSeats] = useState("");
  const [weeklyHours, setWeeklyHours] = useState(DEFAULT_WEEKLY_HOURS);
  const [commonOpen, setCommonOpen] = useState("09:00");
  const [commonClose, setCommonClose] = useState("22:00");
  const [useIndividualHours, setUseIndividualHours] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedulePasteText, setSchedulePasteText] = useState("");
  const [schedulePasteMessage, setSchedulePasteMessage] = useState("");
  const [desc, setDesc] = useState("");
  const [outletRange, setOutletRange] = useState(null);
  const [tags, setTags] = useState({ outlet: false, large: false, interior: false, parking: false, cute: false });
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeResults, setPlaceResults] = useState([]);
  const [placeSearchError, setPlaceSearchError] = useState("");
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const postcodeReady = useDaumPostcodeScript();
  const postcodeContainerRef = useRef(null);

  const canSubmit = name.trim() && address.trim() && outletRange;

  const setSchedulePreset = (preset) => {
    setWeeklyHours((current) => Object.fromEntries(DAYS.map(({ key }) => [key, {
      ...current[key],
      closed: preset === "weekday" ? ["sat", "sun"].includes(key) : preset === "weekend" ? !["sat", "sun"].includes(key) : false,
    }])));
  };

  const getSubmittedWeeklyHours = () => Object.fromEntries(DAYS.map(({ key }) => [key, {
    closed: weeklyHours[key].closed,
    open: useIndividualHours ? weeklyHours[key].open : commonOpen,
    close: useIndividualHours ? weeklyHours[key].close : commonClose,
  }]));

  const applyPastedSchedule = () => {
    const { parsedHours, parsedCount } = parseWeeklyHoursText(schedulePasteText, weeklyHours);
    if (parsedCount === 0) {
      setSchedulePasteMessage("요일별 시간이 인식되지 않았어요. 한 줄에 한 요일씩 붙여넣어 주세요.");
      return;
    }
    setWeeklyHours(parsedHours);
    setUseIndividualHours(true);
    setSchedulePasteMessage(`${parsedCount}개 요일의 운영시간을 적용했어요.`);
  };

  const searchPlace = async () => {
    const query = placeQuery.trim();
    if (!query) return;
    setPlaceSearching(true);
    setGeocodeFailed(false);
    setPlaceSearchError("");
    try {
      const places = await fetchNaverPlaces(query);
      setPlaceSearching(false);
      if (!places.length) {
        setGeocodeFailed(true);
        setPlaceResults([]);
        return;
      }
      setPlaceResults(places);
    } catch (error) {
      console.error("장소 검색 실패:", error);
      setPlaceSearching(false);
      setGeocodeFailed(true);
      setPlaceResults([]);
      setPlaceSearchError(error.message || String(error));
    }
  };

  const selectPlaceResult = (result) => {
    setName(result.name);
    setNaverPlace({
      name: result.name,
      link: `https://map.naver.com/p/search/${encodeURIComponent(`${result.name} ${result.address}`)}`,
      phone: result.phone,
      address: result.address,
    });
    setAddress(result.address);
    onSetLoc({ lat: result.lat, lng: result.lng });
    setPlaceResults([]);
  };

  const handleAddressPicked = (data) => {
    const picked = data.roadAddress || data.jibunAddress || data.address;
    setAddress(picked);
    setGeocodeFailed(false);
    setShowAddressSearch(false);

    if (mapStatus === "ready") {
      setGeocoding(true);
      geocodeAddress(picked, (loc) => {
        setGeocoding(false);
        if (loc) {
          onSetLoc(loc);
        } else {
          setGeocodeFailed(true);
        }
      });
    }
  };

  useEffect(() => {
    if (!showAddressSearch || !postcodeReady || !window.daum || !postcodeContainerRef.current) return;
    postcodeContainerRef.current.innerHTML = "";
    try {
      new window.daum.Postcode({
        oncomplete: handleAddressPicked,
        width: "100%",
        height: "100%",
      }).embed(postcodeContainerRef.current);
    } catch (e) {
      console.error("주소 검색 embed 실패:", e);
    }
  }, [showAddressSearch, postcodeReady]);

  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>카페 등록하기</h2>
        <p style={styles.modalHint}>
          {geocoding
            ? "주소로 위치를 찾는 중이에요..."
            : pickedLoc
            ? `위치 지정됨 (${pickedLoc.lat.toFixed(4)}, ${pickedLoc.lng.toFixed(4)}) · 지도를 클릭하면 위치를 조정할 수 있어요`
            : geocodeFailed
            ? "주소로 정확한 위치를 찾지 못했어요. 오른쪽 지도를 클릭해 위치를 직접 지정해주세요."
            : mapStatus === "ready"
            ? "주소를 검색하면 위치가 지도에 자동으로 표시돼요."
            : "지금은 목업 지도라 자동 위치 지정이 안 돼요. 주소 검색 후 오른쪽 지도를 클릭해 위치를 지정해주세요."}
        </p>

        <div style={styles.formGrid}>
          <div style={{ ...styles.label, gridColumn: "1 / -1" }}>
            주소 *
            <div style={styles.placeSearchRow}>
              <input
                style={styles.input}
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") searchPlace(); }}
                placeholder="카페명 또는 주소로 검색 (예: 명동 투썸플레이스)"
              />
              <button type="button" style={styles.placeSearchBtn} onClick={searchPlace} disabled={!placeQuery.trim() || placeSearching}>
                {placeSearching ? "검색 중..." : "검색"}
              </button>
            </div>
            {placeSearchError && (
              <div style={{ fontSize: 11, color: "#b3441f", marginTop: 4, wordBreak: "break-all" }}>
                {placeSearchError}
              </div>
            )}
            {placeResults.length > 0 && (
              <div style={styles.placeResults}>
                <span style={styles.placeResultsTitle}>검색 결과</span>
                {placeResults.map((result, index) => (
                  <button key={`${result.address}-${index}`} type="button" style={styles.placeResultBtn} onClick={() => selectPlaceResult(result)}>
                    <strong>{result.name}</strong>
                    <small style={styles.placeResultSmall}>{result.address}</small>
                    {result.category && <small style={styles.placeResultCategory}>{result.category}</small>}
                  </button>
                ))}
              </div>
            )}
            {address ? (
              <div style={styles.addressPicked}>
                <span style={styles.addressPickedText}>{address}</span>
                <button type="button" style={styles.addressResearchBtn} onClick={() => setShowAddressSearch(true)}>
                  다시 검색
                </button>
              </div>
            ) : (
              <button type="button" style={styles.addressSearchBtn} onClick={() => setShowAddressSearch(true)} disabled={!postcodeReady}>
                <SearchIcon size={14} color={COLOR.inkSoft} />
                {postcodeReady ? "주소 검색" : "주소 검색 준비 중..."}
              </button>
            )}
          </div>
          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            카페 이름 *
            <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 브루웍스 연남" />
            {naverPlace && <span style={styles.naverPlaceHint}>네이버 장소명을 불러왔어요. 필요하면 이름을 수정할 수 있어요.</span>}
          </label>
          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            좌석 수
            <input style={styles.input} type="number" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="예: 40" />
          </label>
          <div style={{ ...styles.label, gridColumn: "1 / -1" }}>
            <button
              type="button"
              style={styles.scheduleAccordionBtn}
              onClick={() => setShowSchedule((value) => !value)}
              aria-expanded={showSchedule}
            >
              <span>
                <strong style={styles.scheduleAccordionTitle}>요일별 운영시간</strong>
                <span style={styles.scheduleAccordionSummary}>{commonOpen} ~ {commonClose} · 휴무 요일 설정</span>
              </span>
              <span style={styles.scheduleAccordionIcon}>{showSchedule ? "닫기" : "펼치기"}</span>
            </button>
            {showSchedule && <div style={styles.weeklyHoursBox}>
              <div style={styles.commonHoursRow}>
                <span style={styles.commonHoursLabel}>영업시간</span>
                <TimePicker value={commonOpen} onChange={setCommonOpen} label="공통 시작 시간" />
                <span>~</span>
                <TimePicker value={commonClose} onChange={setCommonClose} label="공통 종료 시간" />
              </div>
              <div style={styles.schedulePresets}>
                <span style={styles.schedulePresetLabel}>빠른 설정</span>
                <button type="button" style={styles.schedulePresetBtn} onClick={() => setSchedulePreset("weekday")}>평일만</button>
                <button type="button" style={styles.schedulePresetBtn} onClick={() => setSchedulePreset("weekend")}>주말만</button>
                <button type="button" style={styles.schedulePresetBtn} onClick={() => setSchedulePreset("everyday")}>매일</button>
                <button type="button" style={{ ...styles.schedulePresetBtn, ...(useIndividualHours ? styles.schedulePresetBtnActive : {}) }} onClick={() => setUseIndividualHours((value) => !value)}>
                  {useIndividualHours ? "공통 시간 사용" : "요일별로 다르게 설정"}
                </button>
              </div>
              <div style={styles.schedulePasteBox}>
                {naverPlace?.link ? (
                  <a href={naverPlace.link} target="_blank" rel="noreferrer" style={styles.schedulePasteTitleLink}>
                    네이버 플레이스 운영시간 붙여넣기 ↗
                  </a>
                ) : (
                  <span style={styles.schedulePasteTitle}>네이버 플레이스를 먼저 검색해 선택해주세요</span>
                )}
                <textarea
                  style={styles.schedulePasteInput}
                  value={schedulePasteText}
                  onChange={(e) => { setSchedulePasteText(e.target.value); setSchedulePasteMessage(""); }}
                  placeholder={"예시\n월 09:00 - 22:00\n화 정기휴무\n수 09:00 - 22:00"}
                />
                <div style={styles.schedulePasteActions}>
                  <button type="button" style={styles.scheduleApplyBtn} onClick={applyPastedSchedule}>시간 적용</button>
                  {schedulePasteMessage && <span style={styles.schedulePasteMessage}>{schedulePasteMessage}</span>}
                </div>
              </div>
              {DAYS.map(({ key, label }) => {
                const day = weeklyHours[key];
                return (
                  <div key={key} style={styles.daySchedule}>
                    <label style={{ ...styles.dayClosed, ...(day.closed ? styles.dayClosedActive : {}) }}>
                      <input
                        type="checkbox"
                        checked={day.closed}
                        style={styles.dayCheckbox}
                        onChange={(e) => setWeeklyHours((current) => ({
                          ...current,
                          [key]: { ...current[key], closed: e.target.checked },
                        }))}
                      />
                      <strong>{label}요일</strong>
                      <span style={day.closed ? styles.closedText : styles.openText}>{day.closed ? "휴무" : "영업중"}</span>
                    </label>
                    {day.closed ? (
                      <span style={styles.closedText}>휴무</span>
                    ) : !useIndividualHours ? (
                      <span style={styles.dayHoursText}>{commonOpen} ~ {commonClose}</span>
                    ) : (
                      <div style={styles.timeInputs}>
                        <TimePicker value={day.open} onChange={(value) => setWeeklyHours((current) => ({ ...current, [key]: { ...current[key], open: value } }))} label={`${label}요일 시작 시간`} />
                        <span>~</span>
                        <TimePicker value={day.close} onChange={(value) => setWeeklyHours((current) => ({ ...current, [key]: { ...current[key], close: value } }))} label={`${label}요일 종료 시간`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>}
          </div>
          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            소개
            <textarea style={{ ...styles.input, height: 60, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="이 카페의 특징을 간단히 적어주세요" />
          </label>
        </div>

        <div style={styles.outletField}>
          <span style={styles.outletFieldLabel}>콘센트 있는 좌석 수 (대략) *</span>
          <div style={styles.outletRangeGrid}>
            {OUTLET_RANGES.map(({ value, label }) => (
              <label key={value} style={{ ...styles.outletRangeOption, ...(outletRange === value ? styles.outletRangeOptionActive : {}) }}>
                <input type="radio" name="outletRange" value={value} checked={outletRange === value} onChange={() => setOutletRange(value)} style={styles.visuallyHiddenInput} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={styles.tagCheckRow}>
          {FILTERS.filter(({ key }) => key !== "outlet").map(({ key, label, icon: Icon }) => (
            <label key={key} style={{ ...styles.tagCheck, ...(tags[key] ? styles.tagCheckActive : {}) }}>
              <input
                type="checkbox"
                checked={tags[key]}
                onChange={(e) => setTags((t) => ({ ...t, [key]: e.target.checked }))}
                style={{ display: "none" }}
              />
              <Icon size={13} color={tags[key] ? "#FFFDF8" : "#5B5648"} />
              {label}
            </label>
          ))}
        </div>

        <div style={styles.modalActions}>
          <button style={styles.cancelBtn} onClick={onCancel}>취소</button>
          <button
            style={{ ...styles.submitBtn, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? "pointer" : "not-allowed" }}
            disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit({ name, dong: inferDong(address, placeQuery.split(" ")[0]), address, seats, weeklyHours: getSubmittedWeeklyHours(), desc, tags: { ...tags, outlet: outletRange !== "none" }, outletRange, naverName: naverPlace?.name, naverLink: naverPlace?.link, phone: naverPlace?.phone })}
          >
            등록하기
          </button>
        </div>
      </div>

      {showAddressSearch && (
        <div style={styles.postcodeOverlay} onClick={() => setShowAddressSearch(false)}>
          <div style={styles.postcodeModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.postcodeHeader}>
              <span style={styles.postcodeHeaderTitle}>주소 검색</span>
              <button type="button" style={styles.postcodeCloseBtn} onClick={() => setShowAddressSearch(false)}>
                닫기
              </button>
            </div>
            <div ref={postcodeContainerRef} style={styles.postcodeContainer} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 실제 네이버 지도 ---------- */
function NaverRealMap({ cafes, allCafes, selected, hovered, onSelect, onHover, pickMode, onPick, pickedLoc, onViewportChange }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef({});
  const labelsRef = useRef({});
  const pickMarkerRef = useRef(null);
  const boundsFitRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const onViewportChangeRef = useRef(onViewportChange);
  const selectedRef = useRef(selected);
  const hoveredRef = useRef(hovered);
  const initialIdleRef = useRef(true);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onHoverRef.current = onHover; }, [onHover]);
  useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { hoveredRef.current = hovered; }, [hovered]);

  useEffect(() => {
    if (!window.naver || !mapRef.current || mapObj.current) return;
    try {
      const { naver } = window;
      mapObj.current = new naver.maps.Map(mapRef.current, {
        center: new naver.maps.LatLng(37.5535, 126.914),
        zoom: 14,
      });
    } catch (e) {
      console.error("네이버 지도 초기화 실패:", e);
    }
  }, []);

  useEffect(() => {
    if (!mapObj.current || !window.naver) return;
    const { naver } = window;
    const map = mapObj.current;
    const reportViewport = (isInitial = false) => {
      const bounds = map.getBounds();
      onViewportChangeRef.current({
        minLat: bounds.getMin().lat(),
        maxLat: bounds.getMax().lat(),
        minLng: bounds.getMin().lng(),
        maxLng: bounds.getMax().lng(),
      }, isInitial);
    };
    const listener = naver.maps.Event.addListener(map, "idle", () => {
      reportViewport(initialIdleRef.current);
      initialIdleRef.current = false;
    });
    reportViewport(true);
    return () => naver.maps.Event.removeListener(listener);
  }, []);

  // 카페 목록이 바뀔 때만 마커를 생성/제거 (호버·선택으로는 재생성하지 않음 - 줌 중 충돌 방지)
  useEffect(() => {
    if (!mapObj.current || !window.naver) return;
    const { naver } = window;
    const map = mapObj.current;
    try {
      const currentIds = new Set(cafes.map((c) => String(c.id)));
      [markersRef, labelsRef].forEach((ref) => {
        Object.keys(ref.current).forEach((idStr) => {
          if (!currentIds.has(idStr)) {
            try { ref.current[idStr].setMap(null); } catch (e) {}
            delete ref.current[idStr];
          }
        });
      });

      cafes.forEach((c) => {
        const idStr = String(c.id);
        const position = new naver.maps.LatLng(c.lat, c.lng);

        // 카페 이름 라벨 (핀 밑, 클릭 불가, 항상 표시)
        if (labelsRef.current[idStr]) {
          labelsRef.current[idStr].setPosition(position);
        } else {
          labelsRef.current[idStr] = new naver.maps.Marker({
            position,
            map,
            icon: labelIcon(naver, c.name),
            clickable: false,
            zIndex: 1,
          });
        }

        if (markersRef.current[idStr]) {
          markersRef.current[idStr].setPosition(position);
          return;
        }
        // 새로 생기는 마커도 지금 선택/호버 상태를 바로 반영해야 한다 -
        // 지도가 목록 선택으로 다른 동네로 이동해서 뷰포트에 막 들어온
        // 마커가 항상 기본색으로만 생성되던 문제.
        const idIsSelected = String(selectedRef.current) === idStr;
        const idIsHovered = String(hoveredRef.current) === idStr;
        const spec = pinIconSpec(idIsSelected, idIsHovered);
        const marker = new naver.maps.Marker({
          position,
          map,
          icon: pinImageIcon(naver, spec),
          zIndex: idIsSelected ? 1000 : 2,
        });
        naver.maps.Event.addListener(marker, "click", () => {
          try { onSelectRef.current(c.id); } catch (e) { console.error(e); }
        });
        naver.maps.Event.addListener(marker, "mouseover", () => {
          try { onHoverRef.current(c.id); } catch (e) { console.error(e); }
        });
        naver.maps.Event.addListener(marker, "mouseout", () => {
          try { onHoverRef.current(null); } catch (e) { console.error(e); }
        });
        markersRef.current[idStr] = marker;
      });

      // 목록에서 선택된 카페를 보여주려고 들어온 경우엔 전체를 다 담는
      // fitBounds를 하지 않는다 - 아래 이동 effect가 그 카페로 줌인해서
      // 이동시키는데, fitBounds가 그걸 덮어써서 "이동 안 하는" 것처럼 보였다.
      if (cafes.length > 0 && !boundsFitRef.current) {
        if (selected == null) {
          const bounds = new naver.maps.LatLngBounds();
          cafes.forEach((c) => bounds.extend(new naver.maps.LatLng(c.lat, c.lng)));
          map.fitBounds(bounds);
        }
        boundsFitRef.current = true;
      }
    } catch (e) {
      console.error("마커 갱신 실패:", e);
    }
  }, [cafes, selected]);

  // 선택/호버 상태가 바뀔 때는 기존 마커의 아이콘만 교체 (재생성 없음)
  useEffect(() => {
    if (!window.naver) return;
    const { naver } = window;
    try {
      Object.entries(markersRef.current).forEach(([idStr, marker]) => {
        const isSelected = String(selected) === idStr;
        const isHovered = String(hovered) === idStr;
        const spec = pinIconSpec(isSelected, isHovered);
        marker.setIcon(pinImageIcon(naver, spec));
        if (typeof marker.setZIndex === "function") marker.setZIndex(isSelected ? 1000 : 2);
      });
    } catch (e) {
      console.error("마커 아이콘 갱신 실패:", e);
    }
  }, [selected, hovered]);

  // 목록에서 카페를 선택하면 지도에서도 실제로 보이도록 그 위치로 확대 이동한다.
  useEffect(() => {
    if (!mapObj.current || !window.naver || selected == null) return;
    const target = (allCafes || cafes).find((c) => String(c.id) === String(selected));
    if (!target) return;
    try {
      const { naver } = window;
      // 목록 탭 전환으로 지도 컨테이너가 display:none 이었다가 다시 보이는
      // 경우 내부 크기 계산이 안 맞을 수 있어 먼저 리사이즈를 알려준다.
      naver.maps.Event.trigger(mapObj.current, "resize");
      const coord = new naver.maps.LatLng(target.lat, target.lng);
      if (typeof mapObj.current.morph === "function") {
        mapObj.current.morph(coord, 17);
      } else {
        mapObj.current.setCenter(coord);
        mapObj.current.setZoom(17);
      }
    } catch (e) {
      console.error("지도 이동 실패:", e);
    }
  }, [selected]);

  useEffect(() => {
    if (!mapObj.current || !window.naver) return;
    const { naver } = window;
    const map = mapObj.current;
    let listener;
    try {
      listener = naver.maps.Event.addListener(map, "click", (e) => {
        try {
          if (!pickMode) return;
          onPick(e.coord.y, e.coord.x);
        } catch (err) {
          console.error(err);
        }
      });
    } catch (e) {
      console.error("지도 클릭 리스너 등록 실패:", e);
    }
    return () => {
      try { if (listener) naver.maps.Event.removeListener(listener); } catch (e) {}
    };
  }, [pickMode, onPick]);

  useEffect(() => {
    if (!mapObj.current || !window.naver) return;
    const { naver } = window;
    try {
      if (pickMarkerRef.current) pickMarkerRef.current.setMap(null);
      if (pickedLoc) {
        pickMarkerRef.current = new naver.maps.Marker({
          position: new naver.maps.LatLng(pickedLoc.lat, pickedLoc.lng),
          map: mapObj.current,
          icon: { url: pinDataUrl("#3D6B5F", true), size: new naver.maps.Size(30, 38), scaledSize: new naver.maps.Size(30, 38), anchor: new naver.maps.Point(14, 34) },
        });
      }
    } catch (e) {
      console.error("선택 위치 마커 갱신 실패:", e);
    }
  }, [pickedLoc]);

  return <div ref={mapRef} style={styles.mapSvg} />;
}

/* ---------- 목업(일러스트) 지도 - Client ID 없을 때 대체 ---------- */
function MockMapView({ cafes, selected, hovered, onSelect, onHover, pickMode, onPick, pickedLoc, onViewportChange }) {
  useEffect(() => {
    onViewportChange(BOUNDS, true);
  }, [onViewportChange]);
  const handleBgClick = (e) => {
    if (!pickMode) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const lng = BOUNDS.minLng + (xPct - 4) / 92 * (BOUNDS.maxLng - BOUNDS.minLng);
    const lat = BOUNDS.maxLat - (yPct - 4) / 92 * (BOUNDS.maxLat - BOUNDS.minLat);
    onPick(lat, lng);
  };
  const pickedXY = pickedLoc ? latLngToXY(pickedLoc.lat, pickedLoc.lng) : null;

  return (
    <svg
      viewBox="0 0 100 100"
      style={{ ...styles.mapSvg, cursor: pickMode ? "crosshair" : "default" }}
      preserveAspectRatio="xMidYMid slice"
      onClick={handleBgClick}
    >
      <rect x="0" y="0" width="100" height="100" fill="#E7E2D6" />
      {BLOCKS.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.c} opacity="0.6" rx="1.2" />
      ))}
      {STREETS.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#D8D2C2" strokeWidth={s.w} strokeLinecap="round" />
      ))}

      {cafes.map((c) => {
        const { x, y } = latLngToXY(c.lat, c.lng);
        const isSelected = selected === c.id;
        const isHovered = hovered === c.id;
        const scale = isSelected ? 1.35 : isHovered ? 1.15 : 1;
        return (
          <g
            key={c.id}
            transform={`translate(${x} ${y})`}
            onClick={(e) => { e.stopPropagation(); onSelect(c.id); }}
            onMouseEnter={() => onHover(c.id)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: "pointer" }}
          >
            {isSelected ? (
              <SelectedPinIcon
                size={17.5 * scale}
                x={-(17.5 * scale) * PIN_IMG_SELECTED_TIP_RATIO.x}
                y={-(17.5 * scale) * PIN_IMG_SELECTED_TIP_RATIO.y}
              />
            ) : (
              <image
                href={pinCafeImg}
                width={9 * scale}
                height={9 * scale}
                x={-(9 * scale) * PIN_IMG_TIP_RATIO.x}
                y={-(9 * scale) * PIN_IMG_TIP_RATIO.y}
              />
            )}
            {/* 마커 밑에 카페 이름 라벨 (항상 표시, 선택/호버 시 강조) */}
            {(isSelected || isHovered) ? (
              <g transform={`translate(0 ${3.4 * scale})`}>
                <rect x={-((c.name.length * 1.9 + 3) / 2)} y="0" width={c.name.length * 1.9 + 3} height="5.4" rx="1.4" fill="#26241F" />
                <text x="0" y="3.9" textAnchor="middle" fontSize="2.6" fill="#FFFDF8" fontFamily="'Noto Sans KR', sans-serif">{c.name}</text>
              </g>
            ) : (
              <text
                x="0"
                y={3.4 + 3.9}
                textAnchor="middle"
                fontSize="2.5"
                fontWeight="600"
                fill="#26241F"
                stroke="#FFFDF8"
                strokeWidth="0.9"
                paintOrder="stroke"
                fontFamily="'Noto Sans KR', sans-serif"
              >
                {c.name}
              </text>
            )}
          </g>
        );
      })}

      {pickedXY && (
        <g transform={`translate(${pickedXY.x} ${pickedXY.y})`}>
          <g transform="translate(-2.6 -6.8) scale(0.19)">
            <PinIcon filled color="#3D6B5F" />
          </g>
        </g>
      )}
    </svg>
  );
}

const BLOCKS = [
  { x: 4, y: 4, w: 18, h: 14, c: "#DAD3C1" }, { x: 26, y: 6, w: 14, h: 10, c: "#E0DACB" },
  { x: 6, y: 22, w: 12, h: 16, c: "#DDD6C6" }, { x: 46, y: 4, w: 20, h: 20, c: "#E0DACB" },
  { x: 70, y: 8, w: 22, h: 16, c: "#DAD3C1" }, { x: 4, y: 44, w: 20, h: 18, c: "#DDD6C6" },
  { x: 28, y: 46, w: 16, h: 22, c: "#E0DACB" }, { x: 48, y: 40, w: 18, h: 16, c: "#DAD3C1" },
  { x: 70, y: 34, w: 24, h: 20, c: "#DDD6C6" }, { x: 8, y: 68, w: 22, h: 24, c: "#E0DACB" },
  { x: 34, y: 72, w: 18, h: 20, c: "#DAD3C1" }, { x: 56, y: 64, w: 20, h: 28, c: "#DDD6C6" },
  { x: 78, y: 62, w: 16, h: 22, c: "#E0DACB" },
];
const STREETS = [
  { x1: 0, y1: 20, x2: 100, y2: 20, w: 1.1 }, { x1: 0, y1: 42, x2: 100, y2: 42, w: 1.1 },
  { x1: 0, y1: 62, x2: 100, y2: 62, w: 1.1 }, { x1: 24, y1: 0, x2: 24, y2: 100, w: 1.1 },
  { x1: 46, y1: 0, x2: 46, y2: 100, w: 1.1 }, { x1: 68, y1: 0, x2: 68, y2: 100, w: 1.1 },
];

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
.cf-filterbar::-webkit-scrollbar { display: none; }
button { transition: transform 0.12s ease, box-shadow 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease; }
button:active { transform: scale(0.96); }
.cf-card:active { transform: scale(0.985); box-shadow: 0 1px 2px rgba(38,36,31,0.05); }
@keyframes cf-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes cf-modal-up { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes cf-sheet-up { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }`;

const COLOR = {
  bg: "#EDE9DD", surface: "#FFFDF8", ink: "#26241F", inkSoft: "#6B6355",
  accent: "#B5533C", accentSoft: "#EFDCD3", teal: "#3D6B5F", tealSoft: "#DCE8E2", border: "#DED7C6",
  borderSoft: "rgba(38,36,31,0.07)",
};

const styles = {
  appOuter: {
    minHeight: "100dvh",
    background: "#DDD6C5",
    display: "flex",
    justifyContent: "center",
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  appShell: {
    width: "100%",
    maxWidth: 480,
    minHeight: "100dvh",
    background: COLOR.bg,
    color: COLOR.ink,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 0 44px rgba(38,36,31,0.14)",
  },
  addBtnFloating: { position: "absolute", right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 25, width: 78, height: 78, borderRadius: 39, border: "none", background: COLOR.accent, color: "#FFFDF8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", boxShadow: "0 8px 20px rgba(181,83,60,0.45)" },
  addBtnIcon: { width: 38, height: 38, display: "block" },
  addBtnLabel: { fontSize: 10.5, fontWeight: 700 },
  overlayControls: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, paddingTop: "calc(10px + env(safe-area-inset-top, 0px))" },
  searchBar: { display: "flex", alignItems: "center", gap: 12, margin: "0 16px 10px", padding: "16px 18px", minHeight: 30, borderRadius: 999, border: "none", background: "#FFFFFF", boxShadow: "0 4px 14px rgba(38,36,31,0.16)" },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    fontSize: 17,
    color: COLOR.ink,
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  searchLogo: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0, pointerEvents: "none", color: "rgba(107,99,85,0.55)", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" },
  searchLogoIcon: { width: 16, height: 16, opacity: 0.65 },
  searchClearBtn: { border: "none", background: "transparent", color: COLOR.inkSoft, fontSize: 13, cursor: "pointer", padding: 2, flexShrink: 0 },
  filterBarWrap: { position: "relative", margin: "0 0 12px" },
  filterBar: {
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 10,
    padding: "0 16px",
    overflowX: "auto",
    scrollSnapType: "x proximity",
    scrollPaddingLeft: 16,
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    cursor: "grab",
    userSelect: "none",
  },
  filterBarFade: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    background: `linear-gradient(to right, transparent, ${COLOR.bg})`,
    pointerEvents: "none",
  },
  outletFilterTitle: { display: "block", marginBottom: 9, color: COLOR.ink, fontSize: 12.5 },
  outletFilterOptions: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 7 },
  outletFilterOption: { minHeight: 40, padding: "0 7px", borderRadius: 8, border: `1px solid ${COLOR.borderSoft}`, background: COLOR.surface, color: COLOR.inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer", touchAction: "manipulation", boxShadow: "0 2px 6px rgba(38,36,31,0.08)" },
  outletFilterOptionActive: { borderColor: COLOR.accent, background: COLOR.accentSoft, color: COLOR.accent },
  filterFullMenu: { position: "absolute", top: "calc(100% + 6px)", left: 16, right: 16, zIndex: 20, padding: 14, borderRadius: 16, border: `1px solid ${COLOR.borderSoft}`, background: COLOR.surface, boxShadow: "0 10px 26px rgba(38,36,31,0.16)", animation: "cf-modal-up 0.16s ease" },
  filterFullMenuHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, color: COLOR.ink },
  filterFullMenuClose: { border: "none", background: "transparent", color: COLOR.inkSoft, fontSize: 15, cursor: "pointer", padding: 2 },
  filterFullMenuGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  filterFullMenuReset: { marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "transparent", color: COLOR.inkSoft, fontSize: 12.5, textDecoration: "underline", cursor: "pointer" },
  filterChip: { display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 999, border: "none", background: "#FFFFFF", color: COLOR.ink, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, scrollSnapAlign: "start", boxShadow: "0 3px 10px rgba(38,36,31,0.12)" },
  filterChipActive: { background: COLOR.accent, borderColor: COLOR.accent, color: "#FFFDF8" },
  resetBtn: { padding: "8px 10px", borderRadius: 999, border: "none", background: "transparent", color: COLOR.inkSoft, fontSize: 12, textDecoration: "underline", cursor: "pointer", flexShrink: 0 },
  filterSettingsChip: { display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 999, border: "none", background: "#FFFFFF", cursor: "pointer", flexShrink: 0, scrollSnapAlign: "start", boxShadow: "0 3px 10px rgba(38,36,31,0.12)" },
  mapNotice: { display: "flex", alignItems: "center", gap: 8, margin: "0 16px 10px", padding: "10px 14px", background: COLOR.surface, color: COLOR.inkSoft, fontSize: 12, borderRadius: 999, boxShadow: "0 6px 16px rgba(38,36,31,0.14)" },
  mapNoticeIcon: { flexShrink: 0, fontSize: 14 },
  mapNoticeText: { flex: 1, lineHeight: 1.4 },
  mapNoticeClose: { flexShrink: 0, border: "none", background: "transparent", color: COLOR.inkSoft, fontSize: 13, cursor: "pointer", padding: 2 },
  mobileTabBar: { display: "flex", gap: 8, padding: "0 16px 10px" },
  mobileTabBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, border: "none", background: "#FFFFFF", color: COLOR.ink, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 3px 10px rgba(38,36,31,0.12)" },
  mobileTabBtnActive: { background: COLOR.ink, borderColor: COLOR.ink, color: "#FFFDF8" },
  mainMobile: { flex: 1, minHeight: 0, position: "relative" },
  listPaneMobile: { position: "absolute", inset: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 84px" },
  emptyState: { padding: "40px 20px", textAlign: "center", color: COLOR.inkSoft, fontSize: 13.5, background: COLOR.surface, borderRadius: 14, border: `1px dashed ${COLOR.border}` },
  card: { background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", boxShadow: "0 1px 3px rgba(38,36,31,0.05)", transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease" },
  cardSelected: { borderColor: COLOR.accent, boxShadow: `0 0 0 1px ${COLOR.accent}, 0 4px 12px rgba(181,83,60,0.14)` },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardTitle: { margin: 0, fontSize: 16.5, fontWeight: 700, fontFamily: "'Noto Serif KR', serif", letterSpacing: "-0.01em" },
  cardDong: { margin: "3px 0 0", fontSize: 12, color: COLOR.inkSoft },
  rating: { fontSize: 12.5, color: COLOR.accent, fontWeight: 700, whiteSpace: "nowrap" },
  cardDesc: { margin: "8px 0 10px", fontSize: 13, color: "#514C40", lineHeight: 1.55 },
  badgeRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  badge: { display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "3px 8px", borderRadius: 999, background: COLOR.tealSoft, color: COLOR.teal, fontWeight: 500 },
  cardMeta: { fontSize: 11.5, color: COLOR.inkSoft },
  openBadge: { marginLeft: 6, padding: "1px 7px", borderRadius: 999, background: COLOR.tealSoft, color: COLOR.teal, fontWeight: 600, fontSize: 10.5 },
  closedBadge: { marginLeft: 6, padding: "1px 7px", borderRadius: 999, background: "#EDE3DD", color: "#9B7A68", fontWeight: 600, fontSize: 10.5 },
  mapPaneMobile: { position: "absolute", inset: 0, overflow: "hidden" },
  mapSvg: { width: "100%", height: "100%", display: "block" },
  detailOverlay: { position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(38,36,31,0.5)", animation: "cf-fade-in 0.18s ease" },
  detailModal: { width: "100%", maxWidth: 560, maxHeight: "94vh", overflowY: "auto", overscrollBehaviorY: "contain", padding: "10px 20px 20px", borderRadius: "18px 18px 0 0", background: COLOR.surface, boxShadow: "0 -8px 26px rgba(38,36,31,0.18)", animation: "cf-sheet-up 0.22s ease" },
  detailDragHandle: { width: 40, height: 4, borderRadius: 2, background: COLOR.border, margin: "0 auto 14px" },
  detailHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  detailEyebrow: { margin: 0, color: COLOR.accent, fontSize: 11.5, fontWeight: 600 },
  detailTitle: { margin: "3px 0 0", fontFamily: "'Noto Serif KR', serif", fontSize: 22 },
  detailReviewCount: { margin: "4px 0 0", color: COLOR.inkSoft, fontSize: 12 },
  detailCloseBtn: { width: 40, height: 40, border: "none", borderRadius: 10, background: COLOR.bg, color: COLOR.ink, fontSize: 26, lineHeight: 1, cursor: "pointer" },
  detailFabClose: {
    position: "fixed",
    right: 18,
    bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
    zIndex: 61,
    width: 46,
    height: 46,
    border: "none",
    borderRadius: 23,
    background: "rgba(38,36,31,0.78)",
    color: "#FFFDF8",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(38,36,31,0.3)",
    touchAction: "manipulation",
  },
  detailAddress: { margin: "0 0 10px", color: COLOR.inkSoft, fontSize: 13 },
  detailDescription: { margin: "8px 0 14px", color: "#514C40", fontSize: 13.5, lineHeight: 1.55 },
  detailInfoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
  infoCard: { display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 12, border: `1px solid ${COLOR.borderSoft}`, background: COLOR.surface },
  infoCardValue: { fontSize: 15, fontWeight: 700, color: COLOR.ink },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  detailInfoGridItem: { padding: 10, background: COLOR.surface },
  detailInfoLabel: { display: "flex", alignItems: "center", gap: 5, color: COLOR.inkSoft, fontSize: 11.5 },
  naverMapLink: { display: "block", margin: "0 0 16px", color: COLOR.teal, fontSize: 11.5, fontWeight: 600, textAlign: "right", textDecoration: "underline", textUnderlineOffset: 3 },
  reviewSection: { borderTop: `1px solid ${COLOR.border}`, paddingTop: 15 },
  detailTabs: { display: "flex", gap: 4, marginBottom: 15, borderBottom: `1px solid ${COLOR.border}` },
  detailTab: { flex: 1, minHeight: 44, padding: "0 8px", border: "none", borderBottom: "2px solid transparent", background: "transparent", color: COLOR.inkSoft, fontSize: 13, fontWeight: 600, cursor: "pointer", touchAction: "manipulation" },
  detailTabActive: { borderBottomColor: COLOR.ink, color: COLOR.ink },
  reviewSectionHeader: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 9 },
  reviewTitle: { margin: 0, fontSize: 16, fontWeight: 700, fontFamily: "'Noto Serif KR', serif" },
  writeReviewBtn: { minHeight: 38, padding: "0 12px", border: `1px solid ${COLOR.teal}`, borderRadius: 8, background: COLOR.tealSoft, color: COLOR.teal, fontSize: 12, fontWeight: 600, cursor: "pointer", touchAction: "manipulation" },
  reviewOverlay: { position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(38,36,31,0.55)", animation: "cf-fade-in 0.15s ease" },
  reviewModal: { width: "100%", maxWidth: 420, padding: 18, borderRadius: 16, background: COLOR.surface, boxShadow: "0 10px 30px rgba(38,36,31,0.24)", animation: "cf-modal-up 0.2s ease" },
  reviewModalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reviewModalTitle: { margin: 0, fontSize: 18, fontFamily: "'Noto Serif KR', serif" },
  reviewModalCloseBtn: { width: 38, height: 38, border: "none", borderRadius: 8, background: COLOR.bg, color: COLOR.ink, fontSize: 24, cursor: "pointer" },
  reviewModalCafeName: { margin: "4px 0 13px", color: COLOR.inkSoft, fontSize: 12.5 },
  ratingPicker: { display: "flex", gap: 2, marginBottom: 7 },
  starButton: { width: 30, height: 30, padding: 0, border: "none", background: "transparent", color: COLOR.border, fontSize: 22, lineHeight: 1, cursor: "pointer" },
  starButtonActive: { color: "#D78A32" },
  reviewInput: { width: "100%", minHeight: 66, boxSizing: "border-box", padding: 9, borderRadius: 8, border: `1px solid ${COLOR.border}`, resize: "vertical", background: COLOR.surface, color: COLOR.ink, fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13 },
  reviewImagePreviewRow: { display: "flex", gap: 6, overflowX: "auto", marginTop: 8 },
  reviewImagePreview: { width: 62, height: 62, flexShrink: 0, objectFit: "cover", borderRadius: 7 },
  reviewComposerActions: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 9 },
  photoAttachBtn: { display: "inline-flex", alignItems: "center", minHeight: 38, padding: "0 12px", borderRadius: 8, border: `1px solid ${COLOR.border}`, background: COLOR.surface, color: COLOR.inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  photoAttachBtnLarge: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", boxSizing: "border-box", minHeight: 72, padding: "0 18px", borderRadius: 12, border: `1.5px dashed ${COLOR.teal}`, background: COLOR.tealSoft, color: COLOR.teal, fontSize: 15, fontWeight: 700, cursor: "pointer", touchAction: "manipulation" },
  reviewSubmitBtn: { minHeight: 38, padding: "0 15px", border: "none", borderRadius: 8, background: COLOR.accent, color: "#FFFDF8", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  reviewItem: { padding: "14px 2px", borderBottom: `1px solid ${COLOR.border}` },
  reviewItemTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  reviewStars: { color: "#D78A32", fontSize: 13, letterSpacing: "0.04em" },
  reviewDate: { color: COLOR.inkSoft, fontSize: 11 },
  reviewText: { margin: "7px 0 8px", color: COLOR.ink, fontSize: 13, lineHeight: 1.5 },
  reviewImageGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 },
  reviewImage: { width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 7 },
  photoGallerySection: { marginTop: 16, paddingTop: 15, borderTop: `1px solid ${COLOR.border}` },
  photoGalleryHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  addPhotoBtn: { width: 40, height: 40, padding: 0, border: `1px solid ${COLOR.border}`, borderRadius: 10, background: COLOR.surface, color: COLOR.teal, fontSize: 27, fontWeight: 400, lineHeight: 1, cursor: "pointer", touchAction: "manipulation" },
  photoGallery: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 9 },
  galleryImageButton: { display: "block", minWidth: 0, padding: 0, border: "none", background: "transparent", cursor: "zoom-in" },
  galleryImage: { width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8 },
  emptyPhotoState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 170, padding: 16, borderRadius: 12, border: `1px dashed ${COLOR.border}`, background: "#FAF8F0" },
  emptyPhotoText: { margin: "8px 0 0", color: COLOR.inkSoft, fontSize: 12 },
  centerUploadBtn: { display: "flex", alignItems: "center", gap: 7, minHeight: 48, marginTop: 12, padding: "0 18px", border: "none", borderRadius: 10, background: COLOR.teal, color: "#FFFDF8", fontSize: 13, fontWeight: 600, cursor: "pointer", touchAction: "manipulation" },
  uploadPlus: { fontSize: 22, fontWeight: 300, lineHeight: 1 },
  photoViewerOverlay: { position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,10,0.94)", overscrollBehaviorY: "contain", animation: "cf-fade-in 0.15s ease" },
  photoViewerImage: { maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain", userSelect: "none" },
  photoViewerClose: { position: "absolute", top: 16, right: 16, zIndex: 1, width: 44, height: 44, border: "none", borderRadius: 22, background: "rgba(255,255,255,0.14)", color: "#FFFDF8", fontSize: 29, lineHeight: 1, cursor: "pointer" },
  photoViewerNav: { position: "absolute", top: "50%", zIndex: 1, width: 48, height: 64, marginTop: -32, border: "none", borderRadius: 10, background: "rgba(255,255,255,0.16)", color: "#FFFDF8", fontSize: 42, lineHeight: 1, cursor: "pointer" },
  photoViewerPrev: { left: 16 },
  photoViewerNext: { right: 16 },
  photoViewerCount: { position: "absolute", bottom: 18, left: 0, right: 0, color: "#FFFDF8", fontSize: 12, textAlign: "center" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(38,36,31,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, animation: "cf-fade-in 0.18s ease" },
  modal: { background: COLOR.surface, borderRadius: "18px 18px 0 0", padding: "22px 20px", maxWidth: 480, width: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 -8px 26px rgba(38,36,31,0.18)", animation: "cf-sheet-up 0.22s ease" },

  /* 로그인 팝업 */
  loginModal: { position: "relative", background: COLOR.surface, borderRadius: "18px 18px 0 0", padding: "26px 22px 30px", maxWidth: 480, width: "100%", boxShadow: "0 -8px 26px rgba(38,36,31,0.18)", animation: "cf-sheet-up 0.22s ease" },
  loginTitle: { margin: "0 0 6px", fontFamily: "'Noto Serif KR', serif", fontSize: 20, fontWeight: 700 },
  loginDesc: { margin: "0 0 18px", fontSize: 13, color: COLOR.inkSoft, lineHeight: 1.5 },
  snsBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 48, marginTop: 10, border: "none", borderRadius: 10, fontSize: 14.5, fontWeight: 700, cursor: "pointer" },
  kakaoBtn: { background: "#FEE500", color: "rgba(0,0,0,0.85)" },
  googleBtn: { background: "#FFFFFF", color: "#1F1F1F", border: "1px solid #DADCE0" },
  loginFinePrint: { margin: "14px 0 0", fontSize: 11.5, color: COLOR.inkSoft, textAlign: "center", lineHeight: 1.5 },

  /* 상세보기 즐겨찾기 버튼 */
  favoriteBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", minHeight: 44, marginTop: 12, borderRadius: 10, border: `1px solid ${COLOR.accent}`, background: COLOR.surface, color: COLOR.accent, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  favoriteBtnActive: { background: COLOR.accent, color: "#FFFDF8" },
  favoriteStar: { fontSize: 17, lineHeight: 1 },

  /* 지도 우측 즐겨찾기 보기 토글 */
  favoritesToggleBtn: { position: "absolute", right: 16, bottom: "calc(104px + env(safe-area-inset-bottom, 0px))", zIndex: 25, width: 78, height: 60, borderRadius: 16, border: "none", background: "#FFFFFF", color: COLOR.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", boxShadow: "0 6px 16px rgba(38,36,31,0.22)" },
  favoritesToggleBtnActive: { background: COLOR.accent, color: "#FFFDF8" },
  favoritesToggleStar: { fontSize: 20, lineHeight: 1 },
  favoritesToggleLabel: { fontSize: 10.5, fontWeight: 700 },

  /* 로그인 상태 표시 / 로그아웃 */
  accountBtn: { position: "absolute", right: 16, bottom: "calc(172px + env(safe-area-inset-bottom, 0px))", zIndex: 25, width: 44, height: 44, borderRadius: 22, border: "2px solid #FFFFFF", background: COLOR.teal, color: "#FFFDF8", fontSize: 17, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(38,36,31,0.24)" },
  modalTitle: { margin: "0 0 6px", fontFamily: "'Noto Serif KR', serif", fontSize: 20, fontWeight: 700 },
  modalHint: { margin: "0 0 16px", fontSize: 12.5, color: COLOR.inkSoft, background: COLOR.tealSoft, padding: "8px 12px", borderRadius: 8 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: COLOR.inkSoft, fontWeight: 500 },
  input: { padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLOR.border}`, fontSize: 15, fontFamily: "'Noto Sans KR', sans-serif", color: COLOR.ink },
  naverPlaceHint: { color: COLOR.teal, fontSize: 11 },
  addressSearchBtn: { display: "flex", alignItems: "center", gap: 6, padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLOR.border}`, background: COLOR.surface, color: COLOR.inkSoft, fontSize: 13.5, cursor: "pointer" },
  placeSearchRow: { display: "flex", alignItems: "stretch", gap: 7 },
  placeSearchBtn: { flexShrink: 0, minWidth: 62, border: "none", borderRadius: 8, background: COLOR.teal, color: "#FFFDF8", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  placeResults: { display: "flex", flexDirection: "column", gap: 5, marginTop: 7, padding: 8, borderRadius: 9, border: `1px solid ${COLOR.border}`, background: "#FAF8F0" },
  placeResultsTitle: { padding: "2px 4px", color: COLOR.inkSoft, fontSize: 11.5, fontWeight: 600 },
  placeResultBtn: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, width: "100%", padding: "9px 10px", border: `1px solid ${COLOR.border}`, borderRadius: 8, background: COLOR.surface, color: COLOR.ink, textAlign: "left", cursor: "pointer", touchAction: "manipulation" },
  placeResultSmall: { color: COLOR.inkSoft, fontSize: 11 },
  placeResultCategory: { color: COLOR.teal, fontSize: 10.5 },
  addressPicked: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLOR.border}`, background: COLOR.tealSoft },
  addressPickedText: { fontSize: 13.5, color: COLOR.ink, flex: 1 },
  addressResearchBtn: { padding: "5px 10px", borderRadius: 999, border: "none", background: COLOR.teal, color: "#FFFDF8", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer" },
  scheduleAccordionBtn: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", minHeight: 58, padding: "9px 12px", borderRadius: 10, border: `1px solid ${COLOR.border}`, background: COLOR.surface, color: COLOR.ink, textAlign: "left", cursor: "pointer", touchAction: "manipulation" },
  scheduleAccordionTitle: { display: "block", color: COLOR.ink, fontSize: 13 },
  scheduleAccordionSummary: { display: "block", marginTop: 3, color: COLOR.inkSoft, fontSize: 11.5, fontWeight: 400 },
  scheduleAccordionIcon: { flexShrink: 0, color: COLOR.teal, fontSize: 11.5, fontWeight: 600 },
  postcodeOverlay: { position: "fixed", inset: 0, background: "rgba(38,36,31,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16, animation: "cf-fade-in 0.15s ease" },
  postcodeModal: { background: COLOR.surface, borderRadius: 14, width: "100%", maxWidth: 440, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 10px 30px rgba(38,36,31,0.22)", animation: "cf-modal-up 0.2s ease" },
  postcodeHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${COLOR.border}` },
  postcodeHeaderTitle: { fontSize: 14, fontWeight: 600, color: COLOR.ink },
  postcodeCloseBtn: { border: "none", background: "transparent", color: COLOR.inkSoft, fontSize: 13, cursor: "pointer" },
  postcodeContainer: { width: "100%", height: 440 },
  tagCheckRow: { display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 4px" },
  tagCheck: { display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: `1px solid ${COLOR.border}`, fontSize: 12.5, cursor: "pointer", color: COLOR.ink },
  tagCheckActive: { background: COLOR.teal, borderColor: COLOR.teal, color: "#FFFDF8" },
  outletField: { gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 7, marginTop: 2 },
  outletFieldLabel: { color: COLOR.inkSoft, fontSize: 12.5, fontWeight: 500 },
  outletRangeGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 },
  outletRangeOption: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 5px", borderRadius: 9, border: `1px solid ${COLOR.border}`, background: COLOR.surface, color: COLOR.inkSoft, fontSize: 12, fontWeight: 600, textAlign: "center", cursor: "pointer", touchAction: "manipulation" },
  outletRangeOptionActive: { borderColor: COLOR.teal, background: COLOR.tealSoft, color: COLOR.teal },
  visuallyHiddenInput: { position: "absolute", opacity: 0, pointerEvents: "none" },
  weeklyHoursBox: { display: "flex", flexDirection: "column", gap: 7, padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLOR.border}`, background: "#FAF8F0" },
  commonHoursRow: { display: "flex", alignItems: "center", gap: 6, paddingBottom: 8, borderBottom: `1px solid ${COLOR.border}`, color: COLOR.inkSoft, fontSize: 12 },
  commonHoursLabel: { width: 42, color: COLOR.ink, fontWeight: 600 },
  schedulePresets: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingBottom: 5 },
  schedulePresetLabel: { marginRight: 2, fontSize: 11.5, color: COLOR.inkSoft },
  schedulePresetBtn: { minHeight: 42, padding: "8px 14px", borderRadius: 10, border: `1px solid ${COLOR.border}`, background: COLOR.surface, color: COLOR.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: "pointer", touchAction: "manipulation" },
  schedulePresetBtnActive: { background: COLOR.tealSoft, borderColor: COLOR.teal, color: COLOR.teal },
  schedulePasteBox: { display: "flex", flexDirection: "column", gap: 10, padding: 13, borderRadius: 10, background: COLOR.surface, border: `1px dashed ${COLOR.border}` },
  schedulePasteTitle: { color: COLOR.ink, fontSize: 11.5, fontWeight: 600 },
  schedulePasteTitleLink: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 48, padding: "0 12px", borderRadius: 9, background: COLOR.tealSoft, color: COLOR.teal, fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center", touchAction: "manipulation" },
  schedulePasteInput: { width: "100%", minHeight: 120, boxSizing: "border-box", padding: 12, borderRadius: 8, border: `1px solid ${COLOR.border}`, resize: "vertical", color: COLOR.ink, background: "#FAF8F0", fontFamily: "'Noto Sans KR', sans-serif", fontSize: 14, lineHeight: 1.6 },
  schedulePasteActions: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" },
  scheduleApplyBtn: { minHeight: 48, padding: "0 17px", border: "none", borderRadius: 9, background: COLOR.teal, color: "#FFFDF8", fontSize: 13, fontWeight: 700, cursor: "pointer", touchAction: "manipulation" },
  schedulePasteMessage: { color: COLOR.teal, fontSize: 11 },
  daySchedule: { display: "flex", alignItems: "center", minHeight: 48, gap: 8 },
  dayClosed: { display: "flex", alignItems: "center", gap: 8, flex: 1, minHeight: 44, padding: "5px 9px", borderRadius: 9, color: COLOR.ink, fontSize: 13, cursor: "pointer", touchAction: "manipulation" },
  dayClosedActive: { background: COLOR.accentSoft, color: COLOR.accent },
  dayCheckbox: { width: 24, height: 24, margin: 0, accentColor: COLOR.accent, cursor: "pointer" },
  openText: { color: COLOR.teal },
  closedText: { color: COLOR.accent },
  dayHoursText: { color: COLOR.inkSoft, fontSize: 12 },
  timeInputs: { display: "flex", alignItems: "center", gap: 5, color: COLOR.inkSoft, fontSize: 12 },
  timePicker: { display: "flex", alignItems: "center", borderRadius: 9, border: `1px solid ${COLOR.border}`, background: COLOR.surface },
  timeTextInput: { width: 86, height: 42, padding: "0 9px", border: "none", borderRadius: 8, outline: "none", background: "transparent", color: COLOR.ink, fontSize: 17, fontWeight: 600, textAlign: "center", letterSpacing: "0.04em" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 },
  cancelBtn: { padding: "10px 16px", borderRadius: 999, border: `1px solid ${COLOR.border}`, background: "transparent", fontSize: 13, cursor: "pointer" },
  submitBtn: { padding: "10px 18px", borderRadius: 999, border: "none", background: COLOR.accent, color: "#FFFDF8", fontSize: 13, fontWeight: 600 },
};
