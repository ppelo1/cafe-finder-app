import "dotenv/config";
import http from "node:http";

const port = Number(process.env.API_PORT || 3001);
const naverSearchUrl = "https://naverapihub.apigw.ntruss.com/search/v1/local";

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname !== "/api/places" || request.method !== "GET") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  const query = requestUrl.searchParams.get("query")?.trim();
  if (!query || query.length < 2) {
    sendJson(response, 400, { error: "검색어를 2글자 이상 입력해주세요." });
    return;
  }
  if (!process.env.NAVER_SEARCH_CLIENT_ID || !process.env.NAVER_SEARCH_CLIENT_SECRET) {
    sendJson(response, 500, { error: "네이버 검색 API 환경변수가 설정되지 않았습니다." });
    return;
  }

  try {
    const naverUrl = `${naverSearchUrl}?query=${encodeURIComponent(query)}&display=5&sort=random`;
    const naverResponse = await fetch(naverUrl, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_SEARCH_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": process.env.NAVER_SEARCH_CLIENT_SECRET,
      },
    });
    const data = await naverResponse.json();
    if (!naverResponse.ok) {
      sendJson(response, naverResponse.status, { error: data.errorMessage || "네이버 장소 검색에 실패했습니다." });
      return;
    }

    const places = (data.items || []).map((item) => ({
      name: item.title.replace(/<[^>]*>/g, ""),
      address: item.roadAddress || item.address,
      roadAddress: item.roadAddress,
      jibunAddress: item.address,
      category: item.category,
      link: item.link,
      phone: item.telephone,
      lat: Number(item.mapy) / 10000000,
      lng: Number(item.mapx) / 10000000,
    }));
    sendJson(response, 200, { places });
  } catch (error) {
    console.error("네이버 장소 검색 실패:", error);
    sendJson(response, 502, { error: "네이버 장소 검색 서버에 연결할 수 없습니다." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Place search API listening on http://127.0.0.1:${port}`);
});
