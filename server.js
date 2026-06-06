const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const API_KEY = '9f6dee73221d1e4438de747823e4721b7a8631f04917ca86c4d597ba8fed7aec';
const BASE = 'http://apis.data.go.kr/1480523/WaterQualityService/getWaterMeasuringList';
const DATA_FILE = path.join(__dirname, 'data.json');

const cache = {};

async function fetchYear(year) {
  console.log(`${year}년 API 로딩 중...`);
  const results = [];

  const firstUrl = `${BASE}?numOfRows=100&pageNo=1&serviceKey=${API_KEY}&resultType=json&wmyrList=${year}`;
  const firstRes  = await fetch(firstUrl);
  const firstData = await firstRes.json();
  const totalCount = parseInt(firstData?.getWaterMeasuringList?.totalCount || 0);
  const firstItems = firstData?.getWaterMeasuringList?.item;

  if (firstItems) {
    const arr = Array.isArray(firstItems) ? firstItems : [firstItems];
    results.push(...arr);
  }

  const totalPages = Math.min(Math.ceil(totalCount / 100), 50);

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

  console.log(`✅ ${year}년 ${results.length}건 로드 완료`);
  return results;
}

async function loadYear(year) {
  if (cache[year]) return cache[year];

  // 저장된 파일 있으면 바로 읽기
  const filePath = path.join(__dirname, `data_${year}.json`);
  if (fs.existsSync(filePath)) {
    console.log(`${year}년 파일에서 로드...`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    cache[year] = data;
    return data;
  }

  // 없으면 API에서 받아서 파일로 저장
  const data = await fetchYear(year);
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  cache[year] = data;
  return data;
}

app.get('/api/water', async (req, res) => {
  const year = req.query.year || '2023';
  try {
    const data = await loadYear(year);
    res.json({ getWaterMeasuringList: { item: data } });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('서버 실행 중: http://localhost:3000');
  loadYear('2023');
});
