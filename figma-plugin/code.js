// Runs in Figma's plugin sandbox — has full network access via fetch()
figma.showUI(__html__, { width: 400, height: 520, title: 'KP Photo Picker' });

figma.ui.onmessage = async (msg) => {

  if (msg.type === 'fetch-photos') {
    try {
      const response = await fetch(msg.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();

      // Extract all unique /big- image URLs from images.kupujemprodajem.com
      const regex = /https?:\/\/images\.kupujemprodajem\.com[^"'\s>]+\/big-[^"'\s>]+/g;
      const matches = html.match(regex) || [];
      const unique = [...new Set(matches)];

      if (unique.length === 0) {
        figma.ui.postMessage({ type: 'fetch-error', error: 'No photos found on this listing page.' });
        return;
      }

      const photos = unique.map((url, i) => ({ index: i + 1, url }));
      figma.ui.postMessage({ type: 'photos', photos });

    } catch (err) {
      figma.ui.postMessage({ type: 'fetch-error', error: err.message });
    }
  }

  if (msg.type === 'place-images') {
    const { images } = msg;
    const nodes = [];
    const SPACING = 20;
    const SIZE = 400;

    const viewport = figma.viewport.center;
    let x = viewport.x - (SIZE / 2);
    let y = viewport.y - (SIZE / 2);

    for (const img of images) {
      try {
        const response = await fetch(img.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const figmaImage = figma.createImage(uint8Array);
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

      } catch (err) {
        figma.ui.postMessage({ type: 'image-error', index: img.index, error: err.message });
      }
    }

    if (nodes.length > 0) {
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
    }

    figma.ui.postMessage({ type: 'done', count: nodes.length });
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
