const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const sharp = require('sharp');

const app = express();
const HTTP_PORT = process.env.PORT || 3000;

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

    const srcBuf = Buffer.from(response.data);
    const contentType = (response.headers['content-type'] || '').toLowerCase();

    // Figma's createImage() only accepts PNG and JPEG — convert everything else
    // (WebP, AVIF, …) to JPEG using sharp (libvips, full WebP support).
    const isJpeg = contentType.includes('jpeg');
    const isPng  = contentType.includes('png');
    if (!isJpeg && !isPng) {
      const jpegBuf = await sharp(srcBuf).jpeg({ quality: 90 }).toBuffer();
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(jpegBuf);
    }

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(srcBuf);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

const server = http.createServer(app);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${HTTP_PORT} already in use.`);
    console.error(`Run:  netstat -ano | findstr :${HTTP_PORT}  then  taskkill /PID <pid> /F`);
  } else {
    console.error(err.message);
  }
});
server.listen(HTTP_PORT, () => {
  console.log(`KP Proxy running on http://localhost:${HTTP_PORT}`);
  console.log(`For Figma: run  cloudflared tunnel --url http://localhost:${HTTP_PORT}`);
  console.log(`Then paste the https://....trycloudflare.com URL into the plugin.`);
});
