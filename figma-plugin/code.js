// Runs in Figma's plugin sandbox — no mixed-content rules, can fetch any URL
figma.showUI(__html__, { width: 400, height: 540, title: 'KP Photo Picker' });

// Send persisted proxy URL to UI on startup
figma.clientStorage.getAsync('proxyUrl').then(url => {
  figma.ui.postMessage({ type: 'init', proxyUrl: url || 'http://localhost:3000' });
});

figma.ui.onmessage = async (msg) => {

  if (msg.type === 'save-proxy-url') {
    await figma.clientStorage.setAsync('proxyUrl', msg.url);
  }

  // Fetch images here in the plugin sandbox (no mixed-content restrictions,
  // no User-Agent issues for localhost proxy). ui.html sends URLs, not bytes.
  if (msg.type === 'place-images') {
    const { proxy, images } = msg; // images = [{ index, fullUrl }]
    const nodes = [];
    const SPACING = 20;
    const SIZE = 400;

    const viewport = figma.viewport.center;
    let x = viewport.x - (SIZE / 2);
    let y = viewport.y - (SIZE / 2);

    let errorCount = 0;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      figma.ui.postMessage({ type: 'progress', current: i + 1, total: images.length });

      // Small pause between requests — free Cloudflare tunnels drop connections
      // on rapid sequential fetches; localhost is immune but the delay is negligible.
      if (i > 0) await new Promise(r => setTimeout(r, 400));

      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const fetchUrl = proxy
            ? `${proxy}/image?url=${encodeURIComponent(img.fullUrl)}`
            : img.fullUrl;

          const response = await fetch(fetchUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const arrayBuffer = await response.arrayBuffer();
          const figmaImage = figma.createImage(new Uint8Array(arrayBuffer));

          const rect = figma.createRectangle();
          rect.resize(SIZE, SIZE);
          rect.x = x;
          rect.y = y;
          rect.name = `KP Photo ${img.index}`;
          rect.fills = [{
            type: 'IMAGE',
            imageHash: figmaImage.hash,
            scaleMode: 'FIT',
          }];
          figma.currentPage.appendChild(rect);
          nodes.push(rect);
          x += SIZE + SPACING;
          lastError = null;
          break; // success — stop retrying
        } catch (err) {
          lastError = err;
          if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt));
        }
      }

      if (lastError) {
        errorCount++;
        figma.ui.postMessage({ type: 'image-error', index: img.index, error: lastError.message });
      }
    }

    if (nodes.length > 0) {
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
    }

    figma.ui.postMessage({ type: 'done', count: nodes.length, errorCount });
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
