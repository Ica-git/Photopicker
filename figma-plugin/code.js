// Runs in Figma's plugin sandbox
figma.showUI(__html__, { width: 400, height: 540, title: 'KP Photo Picker' });

// Send persisted proxy URL to UI on startup
figma.clientStorage.getAsync('proxyUrl').then(url => {
  figma.ui.postMessage({ type: 'init', proxyUrl: url || 'http://localhost:3000' });
});

figma.ui.onmessage = async (msg) => {

  // Persist proxy URL whenever it changes
  if (msg.type === 'save-proxy-url') {
    await figma.clientStorage.setAsync('proxyUrl', msg.url);
  }

  // Receive image bytes from ui.html and place them on the canvas
  if (msg.type === 'place-images') {
    const { images } = msg; // array of { index, bytes: number[] }
    const nodes = [];
    const SPACING = 20;
    const SIZE = 400;

    const viewport = figma.viewport.center;
    let x = viewport.x - (SIZE / 2);
    let y = viewport.y - (SIZE / 2);

    for (const img of images) {
      try {
        const figmaImage = figma.createImage(new Uint8Array(img.bytes));
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
