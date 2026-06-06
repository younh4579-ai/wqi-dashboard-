const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.send('server is running');
});

app.get('/api/water', (req, res) => {
  res.json({ ok: true });
});

// ⭐ Railway 필수
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('server running on', PORT);
});
