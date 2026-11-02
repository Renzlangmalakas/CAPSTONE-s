(function (root) {
  'use strict';
  // Read visible letters separately from the printed circular masking dots.
  // This never uses the expected recipient name to manufacture an OCR result.
  async function read(bitmap, lines, worker) {
    const phoneIndex = lines.findIndex(line => /^(?:\+?63|0)[\d\s*-]{8,18}$/.test(line.text.trim()));
    if (phoneIndex < 1) return null;
    const line = lines[phoneIndex - 1];
    const box = line.bbox;
    const height = box.y1 - box.y0 + 1;
    if (height < 12 || lines[phoneIndex].bbox.y0 - box.y1 > height * 5) return null;
    const canvas = document.createElement('canvas');
    canvas.width = box.x1 - box.x0 + 1; canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, box.x0, box.y0, canvas.width, height, 0, 0, canvas.width, height);
    const imageData = context.getImageData(0, 0, canvas.width, height);
    const pixels = imageData.data;
    const width = canvas.width;
    const ink = new Uint8Array(width * height);
    for (let i = 0; i < ink.length; i++) {
      ink[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3 < 150 ? 1 : 0;
      pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = ink[i] ? 0 : 255;
    }
    context.putImageData(imageData, 0, 0);
    const components = [];
    for (let i = 0; i < ink.length; i++) {
      if (!ink[i]) continue;
      const queue = [i]; ink[i] = 0;
      let x0 = width, x1 = 0, y0 = height, y1 = 0;
      for (let n = 0; n < queue.length; n++) {
        const index = queue[n], x = index % width, y = Math.floor(index / width);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, next = ny * width + nx;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && ink[next]) { ink[next] = 0; queue.push(next); }
        }
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      components.push({ x0, x1, y0, y1, w, h, density: queue.length / (w * h) });
    }
    const dots = components.filter(c => c.h >= height * .25 && c.h <= height * .65 &&
      c.w / c.h >= .8 && c.w / c.h <= 1.2 && c.density >= .6).sort((a, b) => a.x0 - b.x0);
    const groups = [];
    for (const dot of dots) {
      const group = groups[groups.length - 1];
      const last = group?.[group.length - 1];
      if (last && dot.x0 - last.x1 < height * .6 && Math.abs(dot.y0 - last.y0) < height * .2) group.push(dot);
      else groups.push([dot]);
    }
    const masks = groups.filter(group => group.length >= 2);
    if (!masks.length) return null;
    // A stray circle could be a letter. Only accept runs of aligned masking dots.
    await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ. ' });
    const parts = []; const confidence = [];
    let start = 0;
    try {
      for (let i = 0; i <= masks.length; i++) {
        const group = masks[i];
        const end = group ? group[0].x0 : width;
        if (end > start + 2) {
          const crop = document.createElement('canvas');
          crop.width = (end - start) * 3 + 30; crop.height = height * 3 + 30;
          const ctx = crop.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, crop.width, crop.height);
          ctx.drawImage(canvas, start, 0, end - start, height, 15, 15, (end - start) * 3, height * 3);
          const result = await worker.recognize(crop);
          const text = result.data.text.trim();
          if (!/^[A-Z][A-Z .]*$/.test(text)) return null;
          if (result.data.confidence < 70) {
            // Short initials score lower. Require an independent segmentation
            // mode to agree on every visible letter; never guess from the payee.
            await worker.setParameters({ tessedit_pageseg_mode: '13', tessedit_char_whitelist: '' });
            const alternate = await worker.recognize(crop);
            await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ. ' });
            const letters = value => value.replace(/[ .\s]/g, '');
            if (result.data.confidence < 60 || alternate.data.confidence < 60 ||
                letters(text) !== letters(alternate.data.text.trim())) return null;
          }
          parts.push(text); confidence.push(result.data.confidence);
        }
        if (group) { parts.push('*'.repeat(group.length)); start = group[group.length - 1].x1 + 1; }
      }
      return { text: parts.join(''), confidence: Math.min(...confidence), source: 'recipient-line-mask-segmentation' };
    } finally {
      await worker.setParameters({ tessedit_pageseg_mode: '3', tessedit_char_whitelist: '' });
    }
  }
  root.GMReceiptRecipientOCR = { read };
})(window);
