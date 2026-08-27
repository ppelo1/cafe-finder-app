import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("server/data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "cafes.sqlite"));
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS cafes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dong TEXT DEFAULT '',
    address TEXT NOT NULL,
    phone TEXT DEFAULT '',
    naver_name TEXT DEFAULT '',
    naver_link TEXT DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '{}',
    outlet_range TEXT DEFAULT 'none',
    seats INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    hours TEXT DEFAULT '정보 없음',
    weekly_hours_json TEXT,
    description TEXT DEFAULT '',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cafe_id INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL DEFAULT 0,
    text TEXT DEFAULT '',
    images_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function mapCafe(row) {
  const reviews = db.prepare("SELECT id, rating, text, images_json, created_at FROM reviews WHERE cafe_id = ? ORDER BY id DESC").all(row.id).map((review) => ({
    id: review.id,
    rating: review.rating,
    text: review.text,
    images: JSON.parse(review.images_json),
    createdAt: new Date(`${review.created_at}Z`).toLocaleDateString("ko-KR"),
  }));
  return {
    id: row.id,
    name: row.name,
    dong: row.dong,
    address: row.address,
    phone: row.phone,
    naverName: row.naver_name,
    naverLink: row.naver_link,
    tags: JSON.parse(row.tags_json),
    outletRange: row.outlet_range,
    seats: row.seats,
    rating: row.rating,
    hours: row.hours,
    weeklyHours: row.weekly_hours_json ? JSON.parse(row.weekly_hours_json) : undefined,
    desc: row.description,
    lat: row.lat,
    lng: row.lng,
    reviews,
  };
}

export function listCafes(bounds) {
  let rows;
  if (bounds) {
    rows = db.prepare("SELECT * FROM cafes WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? ORDER BY id DESC").all(bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng);
  } else {
    rows = db.prepare("SELECT * FROM cafes ORDER BY id DESC").all();
  }
  return rows.map(mapCafe);
}

export function insertCafe(cafe) {
  const result = db.prepare(`INSERT INTO cafes (name, dong, address, phone, naver_name, naver_link, tags_json, outlet_range, seats, rating, hours, weekly_hours_json, description, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`).run(
    cafe.name, cafe.dong || "", cafe.address, cafe.phone || "", cafe.naverName || "", cafe.naverLink || "",
    JSON.stringify(cafe.tags || {}), cafe.outletRange || "none", Number(cafe.seats) || 0, cafe.hours || "정보 없음",
    cafe.weeklyHours ? JSON.stringify(cafe.weeklyHours) : null, cafe.desc || "", Number(cafe.lat), Number(cafe.lng),
  );
  return listCafes().find((item) => item.id === Number(result.lastInsertRowid));
}

export function insertReview(cafeId, review) {
  const result = db.prepare("INSERT INTO reviews (cafe_id, rating, text, images_json) VALUES (?, ?, ?, ?)").run(cafeId, Number(review.rating) || 0, review.text || "", JSON.stringify(review.images || []));
  return db.prepare("SELECT id, rating, text, images_json, created_at FROM reviews WHERE id = ?").get(Number(result.lastInsertRowid));
}
