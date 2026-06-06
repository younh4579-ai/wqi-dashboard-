const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const API_KEY = '9f6dee73221d1e4438de747823e4721b7a8631f04917ca86c4d597ba8fed7aec';
const BASE = 'http://apis.data.go.kr/1480523/WaterQualityService/getWaterMeasuringList';

let cachedData = null;

async function loadData() {
  console.log('전국 수질 데이터 로딩 시작...');
  const years = ['2025', '2024', '2023'];
  const results = [];

  for (const year of years) {
    try {
      const firstUrl = `${BASE}?numOfRows=100&pageNo=1&serviceKey=${API_KEY}&resultType=json&wmyrList=${year}`;
      const firstRes  = await fetch(firstUrl);
      const firstData = await firstRes.json();
      const totalCount = parseInt(firstData?.getWaterMeasuringList?.totalCount || 0);
      const firstItems = firstData?.getWaterMeasuringList?.item;

      if (!firstItems || totalCount === 0) {
        console.log(`${year}년 데이터 없음, 다음 연도 시도...`);
        continue;
      }

      const arr = Array.isArray(firstItems) ? firstItems : [firstItems];
      results.push(...arr);

      const totalPages = Math.min(Math.ceil(totalCount / 100), 50);
      console.log(`${year}년 전체 ${totalCount}건 / ${totalPages}페이지 로드 중...`);

      const pagePromises = [];
      for (let page = 2; page <= totalPages; page++) {
        const url = `${BASE}?numOfRows=100&pageNo=${page}&serviceKey=${API_KEY}&resultType=json&wmyrList=${year}`;
        pagePromises.push(
          fetch(url)
            .then(r => r.json())
            .then(data => {
              const items = data?.getWaterMeasuringList?.item;
              if (items) return Array.isArray(items) ? items : [items];
              return [];
            })
            .catch(() => [])
        );
      }

      const pages = await Promise.all(pagePromises);
      pages.forEach(page => results.push(...page));

      console.log(`✅ ${year}년 데이터 로드 완료: ${results.length}건 캐시됨`);
      break;

    } catch(e) {
      console.warn(`${year}년 실패:`, e.message);
    }
  }

  cachedData = results;
}

app.get('/api/water', (req, res) => {
  if (!cachedData) {
    return res.status(503).json({ error: '데이터 로딩 중입니다. 잠시 후 다시 시도해주세요.' });
  }
  res.json({ getWaterMeasuringList: { item: cachedData } });
});

app.listen(3000, () => {
  console.log('서버 실행 중: http://localhost:3000');
  loadData();
});
