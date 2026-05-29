const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const https = require('https');
const selfsigned = require('selfsigned');

const app = express();
const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'sr-RS,sr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 15000,
    });

    const html = response.data;

    const bigRegex = /https:\/\/images\.kupujemprodajem\.com\/photos\/oglasi\/[^"'\s]+\/big-[^"'\s]+\.webp/g;
    const bigMatches = [...new Set(html.match(bigRegex) || [])];
    if (bigMatches.length > 0) {
      const photos = bigMatches.map((fullUrl, index) => ({
        index: index + 1,
        thumbnail: fullUrl.replace('/big-', '/tmb-300x300-'),
        full: fullUrl,
      }));
      return res.json({ count: photos.length, photos });
    }

    const tmbRegex = /https:\/\/images\.kupujemprodajem\.com\/photos\/oglasi\/[^"'\s]+\/tmb-300x300-[^"'\s]+\.webp/g;
    const tmbMatches = [...new Set(html.match(tmbRegex) || [])];
    if (tmbMatches.length > 0) {
      const photos = tmbMatches.map((tmbUrl, index) => ({
        index: index + 1,
        thumbnail: tmbUrl,
        full: tmbUrl.replace('/tmb-300x300-', '/big-'),
      }));
      return res.json({ count: photos.length, photos });
    }

    return res.status(404).json({ error: 'No photos found on this listing' });
  } catch (err) {
    const httpStatus = err.response?.status;
    const detail = err.response?.data
      ? String(err.response.data).slice(0, 200)
      : err.message;
    console.error(`/photos fetch failed: ${httpStatus} - ${detail}`);
    res.status(500).json({
      error: httpStatus === 404
        ? 'KP blocked this request (datacenter IP). Run the proxy locally: node server.js'
        : 'Failed to fetch listing',
      httpStatus,
      detail,
    });
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

async function start() {
  // Generate a self-signed certificate for localhost (selfsigned v5+ is async)
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    days: 825,
    algorithm: 'sha256',
    extensions: [
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] },
    ],
  });

  http.createServer(app).listen(HTTP_PORT, () => {
    console.log(`KP Proxy HTTP  → http://localhost:${HTTP_PORT}`);
  });

  https.createServer({ key: pems.private, cert: pems.cert }, app).listen(HTTPS_PORT, () => {
    console.log(`KP Proxy HTTPS → https://localhost:${HTTPS_PORT}`);
    console.log(`First time? Visit https://localhost:${HTTPS_PORT} in your browser and accept the certificate.`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
