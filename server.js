const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'KP Proxy running' });
});

app.get('/photos', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.includes('kupujemprodajem.com')) {
    return res.status(400).json({ error: 'Invalid or missing KupujemProdajem URL' });
  }
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'sr,en-US;q=0.7,en;q=0.3',
      },
      timeout: 10000,
    });
    const html = response.data;
    const bigRegex = /https:\/\/images\.kupujemprodajem\.com\/photos\/oglasi\/[^"'\s]+\/big-[^"'\s]+\.webp/g;
    const bigMatches = [...new Set(html.match(bigRegex) || [])];
    const tmbRegex = /https:\/\/images\.kupujemprodajem\.com\/photos\/oglasi\/[^"'\s]+\/tmb-300x300-[^"'\s]+\.webp/g;
    const tmbMatches = [...new Set(html.match(tmbRegex) || [])];
    let photos = [];
    if (bigMatches.length > 0) {
      photos = bigMatches.map((fullUrl, index) => {
        const tmbUrl = fullUrl.replace('/big-', '/tmb-300x300-');
        return { index: index + 1, thumbnail: tmbUrl, full: fullUrl };
      });
    } else if (tmbMatches.length > 0) {
      photos = tmbMatches.map((tmbUrl, index) => {
        const fullUrl = tmbUrl.replace('/tmb-300x300-', '/big-');
        return { index: index + 1, thumbnail: tmbUrl, full: fullUrl };
      });
    }
    if (photos.length === 0) {
      return res.status(404).json({ error: 'No photos found on this listing' });
    }
    res.json({ count: photos.length, photos });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch listing. Try again.' });
  }
});

app.get('/image', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.includes('kupujemprodajem.com')) {
    return res.status(400).json({ error: 'Invalid image URL' });
  }
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.kupujemprodajem.com/',
      },
      timeout: 15000,
    });
    res.set('Content-Type', response.headers['content-type'] || 'image/webp');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

app.listen(PORT, () => {
  co
