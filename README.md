# KP Photo Picker — Setup Guide

## PART 1: Deploy the Proxy Server (Render.com)

1. Go to https://github.com and create a free account (if you don't have one)
2. Create a new repository called `kp-proxy`
3. Upload these two files into it: `server.js` and `package.json`
4. Go to https://render.com and sign up (free)
5. Click **"New"** → **"Web Service"**
6. Connect your GitHub account and select your `kp-proxy` repo
7. Fill in:
   - Name: `kp-proxy`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
8. Click **"Create Web Service"**
9. Wait ~2 minutes — Render gives you a URL like `https://kp-proxy-xxxx.onrender.com`
10. Test it: open `https://kp-proxy-xxxx.onrender.com` in browser — you should see `{"status":"KP Proxy running"}`

---

## PART 2: Install the Figma Plugin

1. Open **Figma Desktop App** (must be desktop, not browser)
2. Go to menu: **Figma logo → Plugins → Development → Import plugin from manifest...**
3. Navigate to the `figma-plugin` folder and select `manifest.json`
4. Done! The plugin is now installed in development mode

To run it:
- Right-click anywhere on the canvas → **Plugins → Development → KP Photo Picker**

---

## PART 3: Share with Your Team

1. In Figma: **Figma logo → Plugins → Development → KP Photo Picker → Publish**
2. Set visibility to **"Anyone at [your org]"**
3. Your teammates find it under: **Plugins → [Your org name] → KP Photo Picker**

---

## How to Use

1. Run the plugin
2. Paste your proxy URL into the top field (saved automatically after first use)
3. Paste a KupujemProdajem listing URL
4. Click **Load Photos** — thumbnails appear
5. Click the photos you want to select them (blue border = selected)
6. Click **Place Photos on Board**
7. Images appear on your Figma canvas — drag them into your template!

