const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const API_KEY = '여기에_API_KEY';
const BASE = 'http://apis.data.go.kr/1480523/WaterQualityService/getWaterMeasuringList';

let cachedData = [];

async function loadData() {
  console.log('전국 수질 데이터 로딩 시작...');

  const years = ['2025', '2024', '2023'];
  const results = [];

  let usedYear = null;

  for (const year of years) {
    try {
      const firstUrl =
        `${BASE}?numOfRows=100&pageNo=1&serviceKey=${API_KEY}&resultType=json&wmyrList=${year}`;

      const firstRes = await fetch(firstUrl);
      const firstData = await firstRes.json();

      const totalCount = parseInt(
        firstData?.getWaterMeasuringList?.totalCount || 0
      );

      const firstItems = firstData?.getWaterMeasuringList?.item;

      // 👉 데이터 없으면 다음 연도로 넘어감
      if (!firstItems || totalCount === 0) {
        console.log(`${year}년 데이터 없음`);
        continue;
      }

      console.log(`✅ ${year}년 데이터 사용 (최신 선택됨)`);

      usedYear = year;

      const arr = Array.isArray(firstItems)
        ? firstItems
        : [firstItems];

      results.push(...arr);

      const totalPages = Math.min(
        Math.ceil(totalCount / 100),
        50
      );

      for (let page = 2; page <= totalPages; page++) {
        try {
          const url =
            `${BASE}?numOfRows=100&pageNo=${page}&serviceKey=${API_KEY}&resultType=json&wmyrList=${year}`;

          const res = await fetch(url);
          const data = await res.json();

          const items = data?.getWaterMeasuringList?.item;

          if (items) {
            results.push(
              ...(Array.isArray(items) ? items : [items])
            );
          }
        } catch (e) {}
      }

      // 👉 여기 핵심
      // 최신 "유효한 연도" 찾으면 즉시 종료
      break;

    } catch (e) {
      console.warn(`${year}년 실패`);
    }
  }

  cachedData = results;

  console.log(`총 ${cachedData.length}건 로드 완료 (${usedYear} 사용)`);
}

app.get('/api/water', (req, res) => {
  if (!cachedData.length) {
    return res.status(503).json({
      error: '데이터 로딩 중입니다'
    });
  }

  res.json({
    getWaterMeasuringList: {
      item: cachedData
    }
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버 실행: ${PORT}`);
  loadData();
});
