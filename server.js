const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const API_KEY = '여기에_본인_API_KEY';
const BASE = 'http://apis.data.go.kr/1480523/WaterQualityService/getWaterMeasuringList';

let cachedData = [];

async function loadData() {
  console.log('전국 수질 데이터 로딩 시작...');

  const years = ['2025', '2024', '2023'];
  const results = [];

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

      if (!firstItems || totalCount === 0) {
        console.log(`${year}년 데이터 없음`);
        continue;
      }

      const arr = Array.isArray(firstItems)
        ? firstItems
        : [firstItems];

      results.push(...arr);

      const totalPages = Math.min(
        Math.ceil(totalCount / 100),
        50
      );

      console.log(
        `${year}년 ${totalCount}건 / ${totalPages}페이지 로드`
      );

      for (let page = 2; page <= totalPages; page++) {
        try {
          const url =
            `${BASE}?numOfRows=100&pageNo=${page}&serviceKey=${API_KEY}&resultType=json&wmyrList=${year}`;

          const res = await fetch(url);
          const data = await res.json();

          const items =
            data?.getWaterMeasuringList?.item;

          if (items) {
            results.push(
              ...(Array.isArray(items)
                ? items
                : [items])
            );
          }
        } catch (err) {
          console.warn(`${year}년 ${page}페이지 실패`);
        }
      }

      console.log(`✅ ${year}년 완료`);
    } catch (err) {
      console.warn(`${year}년 실패`, err.message);
    }
  }

  cachedData = results;

  console.log(
    `총 ${cachedData.length}건 캐시 완료`
  );
}

app.get('/api/water', (req, res) => {
  if (!cachedData.length) {
    return res.status(503).json({
      error: '데이터 로딩 중입니다.'
    });
  }

  const year = req.query.year;

  let result = cachedData;

  if (year) {
    result = cachedData.filter(
      item => String(item.WMYR) === String(year)
    );
  }

  res.json({
    getWaterMeasuringList: {
      item: result
    }
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버 실행: ${PORT}`);
  loadData();
});
