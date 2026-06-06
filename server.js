
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const API_KEY = '여기에_API_KEY';
const BASE = 'http://apis.data.go.kr/1480523/WaterQualityService/getWaterMeasuringList';

let cachedData = [];
let isLoading = false;

/**
 * 안전하게 JSON 파싱 (서버 안 죽게 하는 핵심)
 */
async function safeJson(res) {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

/**
 * 데이터 로딩 (안 죽는 구조)
 */
async function loadData() {
  if (isLoading) return;
  isLoading = true;

  console.log('📡 수질 데이터 로딩 시작...');

  const years = ['2025', '2024', '2023'];
  const results = [];
  let usedYear = null;

  for (const year of years) {
    try {
      const url =
        `${BASE}?numOfRows=100&pageNo=1&serviceKey=${API_KEY}&resultType=json&wmyrList=${year}`;

      const res = await fetch(url);
      const data = await safeJson(res);

      if (!data || !data.getWaterMeasuringList) {
        console.log(`❌ ${year} 데이터 없음 또는 API 오류`);
        continue;
      }

      const totalCount = parseInt(
        data.getWaterMeasuringList.totalCount || 0
      );

      const firstItems = data.getWaterMeasuringList.item;

      if (!firstItems || totalCount === 0) {
        console.log(`❌ ${year} 데이터 없음`);
        continue;
      }

      console.log(`✅ ${year} 데이터 사용`);

      usedYear = year;

      const arr = Array.isArray(firstItems)
        ? firstItems
        : [firstItems];

      results.push(...arr);

      const totalPages = Math.min(
        Math.ceil(totalCount / 100),
        30
      );

      for (let page = 2; page <= totalPages; page++) {
        try {
          const pageUrl =
            `${BASE}?numOfRows=100&pageNo=${page}&serviceKey=${API_KEY}&resultType=json&wmyrList=${year}`;

          const pageRes = await fetch(pageUrl);
          const pageData = await safeJson(pageRes);

          const items = pageData?.getWaterMeasuringList?.item;

          if (items) {
            results.push(
              ...(Array.isArray(items) ? items : [items])
            );
          }
        } catch (e) {
          console.warn(`페이지 실패: ${year}-${page}`);
        }
      }

      // 👉 가장 최신 데이터 1개만 사용
      break;

    } catch (err) {
      console.warn(`❌ ${year} 실패`);
    }
  }

  cachedData = results;
  isLoading = false;

  console.log(`🎯 완료: ${usedYear} 사용 / ${cachedData.length}건`);
}

/**
 * API (안 죽는 구조)
 */
app.get('/api/water', (req, res) => {
  if (!cachedData.length) {
    return res.status(503).json({
      error: '데이터 로딩 중입니다'
    });
  }

  const year = req.query.year;

  let result = cachedData;

  if (year) {
    result = cachedData.filter(
      d => String(d.WMYR) === String(year)
    );
  }

  res.json({
    getWaterMeasuringList: {
      item: result
    }
  });
});

/**
 * 서버 시작
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 서버 실행: ${PORT}`);

  // Railway 안정성 때문에 딜레이 후 실행
  setTimeout(() => {
    loadData().catch(err => {
      console.error('🔥 loadData 전체 실패:', err);
    });
  }, 3000);
});
