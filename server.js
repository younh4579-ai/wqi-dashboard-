const express = require('express');
const cors = require('cors');
const fetch = global.fetch; // Node 18+ 기본 fetch 사용

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const API_KEY = process.env.API_KEY;
const BASE = 'http://apis.data.go.kr/1480523/WaterQualityService/getWaterMeasuringList';

let cachedData = [];

// 안전 JSON 파서
async function safeFetchJson(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    return JSON.parse(text);
  } catch (e) {
    console.log('API 실패:', e.message);
    return null;
  }
}

// 최신 연도 자동 선택
async function loadData() {
  console.log('데이터 로딩 시작');

  const years = ['2025', '2024', '2023'];

  for (const year of years) {
    const url =
      `${BASE}?numOfRows=100&pageNo=1&serviceKey=${API_KEY}&resultType=json&wmyrList=${year}`;

    const data = await safeFetchJson(url);

    const items = data?.getWaterMeasuringList?.item;

    if (items) {
      cachedData = Array.isArray(items) ? items : [items];
      console.log(`사용 데이터 연도: ${year}`);
      console.log(`데이터 개수: ${cachedData.length}`);
      return;
    }
  }

  cachedData = [];
  console.log('데이터 없음');
}

// 헬스체크
app.get('/', (req, res) => {
  res.send('server is running 🚀');
});

// API
app.get('/api/water', (req, res) => {
  res.json({
    ok: true,
    count: cachedData.length,
    data: cachedData
  });
});

// Railway 필수 설정
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('server running on', PORT);
  loadData();
});
