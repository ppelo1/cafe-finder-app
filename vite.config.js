import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 커스텀 도메인(cafeodi.store)에서 루트로 서비스되므로 base는 "/"로 고정한다.
  base: "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});
