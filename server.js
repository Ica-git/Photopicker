const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'sr-RS,sr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

async function getSessionCookies() {
  try {
    const res = await axios.get('https://www.kupujemprodajem.com/', {
      headers: BROWSER_HEADERS,
      timeout: 10000,
      validateStatus: () => true,
    });
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) return '';
    return setCookie.map(c => c.split(';')[0]).join('; ');
  } catch {
    return '';
  }
}

function extractPhotos(html) {
  const bigRegex = /https:\/\/images\.kupujemprodajem\.com\/photos\/oglasi\/[^"'\s]+\/big-[^"'\s]+\.webp/g;
  const bigMatches = [...new Set(html.match(bigRegex) || [])];
  if (bigMatches.length > 0) {
    return bigMatches.map((fullUrl, index) => ({
      index: index + 1,
      thumbnail: fullUrl.replace('/big-', '/tmb-300x300-'),
      full: fullUrl,
    }));
  }
  const tmbRegex = /https:\/\/images\.kupujemprodajem\.com\/photos\/oglasi\/[^"'\s]+\/tmb-300x300-[^"'\s]+\.webp/g;
  const tmbMatches = [...new Set(html.match(tmbRegex) || [])];
  if (tmbMatches.length > 0) {
    return tmbMatches.map((tmbUrl, index) => ({
      index: index + 1,
      thumbnail: tmbUrl,
      full: tmbUrl.replace('/tmb-300x300-', '/big-'),
    }));
  }
  return [];
}

app.get('/', (req, res) => {
  res.json({ status: 'KP Proxy running' });
});

app.get('/photos', async (req, res) => {
  const { url, debug } = req.query;
  if (!url || !url.includes('kupujemprodajem.com')) {
    return res.status(400).json({ error: 'Invalid or missing KupujemProdajem URL' });
  }

  try {
    const cookies = await getSessionCookies();
    const headers = { ...BROWSER_HEADERS };
    if (cookies) {
      headers['Cookie'] = cookies;
      headers['Sec-Fetch-Site'] = 'same-origin';
    }

    const response = await axios.get(url, {
      headers,
      timeout: 15000,
      validateStatus: () => true,
    });

    const httpStatus = response.status;
    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    if (debug === '1') {
      return res.json({
        httpStatus,
        bodyLength: html.length,
        bodyPreview: html.slice(0, 1000),
        cookies: cookies || 'none',
      });
    }

    const photos = extractPhotos(html);

    if (photos.length === 0) {
      return res.status(404).json({
        error: 'No photos found on this listing',
        httpStatus,
        bodyLength: html.length,
        bodyPreview: html.slice(0, 500),
      });
    }

    res.json({ count: photos.length, photos });
  } catch (err) {
    const httpStatus = err.response?.status;
    const detail = err.response?.data
      ? String(err.response.data).slice(0, 300)
      : err.message;
    console.error(`/photos fetch failed: httpStatus=${httpStatus}, detail=${detail}`);
    res.status(500).json({ error: 'Failed to fetch listing', httpStatus, detail });
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
  console.log(`KP Proxy server running on port ${PORT}`);
});
