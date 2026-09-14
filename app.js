// PixelBeads - 拼豆图纸生成器
// 核心逻辑：图片采样、色彩量化、图纸渲染、编辑与导出

// ========== 色库定义 ==========
const PALETTES = {
  smart: [], // 智能聚类动态生成
  perler: [
    '#FF0000','#FF6B35','#F7C548','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F',
    '#BB8FCE','#85C1E9','#F8B500','#FF69B4','#32CD32','#FFD700','#FF4500','#8A2BE2','#00CED1','#FF1493',
    '#7CFC00','#FFDAB9','#E6E6FA','#F0E68C','#D2691E','#A0522D','#808080','#000000','#FFFFFF'
  ],
  artkal: [
        '#FF0040','#FF8000','#FFC000','#FFFF00','#80FF00','#00FF00','#00FF80','#00FFFF','#0080FF','#0000FF',
    '#8000FF','#FF00FF','#FF0080','#C0C0C0','#808080','#404040','#000000','#FFFFFF','#800000','#808000',
    '#008000','#008080','#000080','#800080','#FFA07A','#F0E68C','#90EE90','#87CEEB','#DDA0DD'
  ],
  nabbi: [
    '#FF0000','#FF7F00','#FFFF00','#00FF00','#0000FF','#4B0082','#9400D3','#FF1493','#00CED1','#32CD32',
    '#FFD700','#FF69B4','#87CEEB','#98FB98','#DDA0DD','#F0E68C','#FFA07A','#20B2AA','#778899','#B0C4DE',
    '#FF6347','#40E0D0','#EE82EE','#F5DEB3','#000000','#FFFFFF','#C0C0C0','#808080'
  ],
  custom: []
};

// 从自定义文本解析色盘
function parseCustomPalette(text) {
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => /^#[0-9A-Fa-f]{6}$/.test(line));
}

// ========== 颜色工具 ==========
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function colorDistance(c1, c2) {
  // 加权欧氏距离，更接近人眼感知
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

function findClosestColor(rgb, palette) {
  let minDist = Infinity;
  let closest = palette[0];
  for (const hex of palette) {
    const dist = colorDistance(rgb, hexToRgb(hex));
    if (dist < minDist) {
      minDist = dist;
      closest = hex;
    }
  }
  return closest;
}

// K-means 聚类生成智能色盘
function kMeansPalette(pixels, k) {
  if (pixels.length === 0) return PALETTES.perler.slice(0, k);
  // 初始化中心点：随机采样
  let centroids = [];
  const step = Math.max(1, Math.floor(pixels.length / k));
  for (let i = 0; i < k && i * step < pixels.length; i++) {
    centroids.push([...pixels[i * step]]);
  }
  // 迭代收敛
  for (let iter = 0; iter < 10; iter++) {
    const clusters = Array.from({ length: k }, () => []);
    for (const p of pixels) {
      let minDist = Infinity, idx = 0;
      for (let i = 0; i < k; i++) {
        const d = colorDistance(p, centroids[i]);
        if (d < minDist) { minDist = d; idx = i; }
      }
      clusters[idx].push(p);
    }
    // 更新中心
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        const sum = clusters[i].reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
        centroids[i] = sum.map(v => Math.round(v / clusters[i].length));
      }
    }
  }
  return centroids.map(c => rgbToHex(c[0], c[1], c[2]));
}

// ========== 全局状态 ==========
const state = {
  originalImage: null,      // HTMLImageElement
  gridWidth: 29,
  gridHeight: 29,
  cellSize: 20,             // 每个格子的像素大小（画布上）
  gridData: [],             // 二维数组，存储每个格子的颜色 hex
  palette: [],
  tool: 'brush',            // brush | fill | eraser | picker
  currentColor: '#FF0000',
  isDrawing: false,
  fillStart: null,          // 矩形填充起点
  mirror: false
};

// ========== DOM 元素 ==========
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const generateBtn = document.getElementById('generateBtn');
const editorSection = document.getElementById('editorSection');
const beadCanvas = document.getElementById('beadCanvas');
const ctx = beadCanvas.getContext('2d');
const paletteMode = document.getElementById('paletteMode');
const customPaletteInput = document.getElementById('customPaletteInput');
const customColors = document.getElementById('customColors');
const samplingStrength = document.getElementById('samplingStrength');
const colorSimplify = document.getElementById('colorSimplify');
const samplingValue = document.getElementById('samplingValue');
const simplifyValue = document.getElementById('simplifyValue');
const physicalHint = document.getElementById('physicalHint');
const customWidth = document.getElementById('customWidth');
const customHeight = document.getElementById('customHeight');
const colorCount = document.getElementById('colorCount');
const beadCount = document.getElementById('beadCount');
const currentColorInput = document.getElementById('currentColor');
const mirrorMode = document.getElementById('mirrorMode');

// ========== 事件绑定 ==========
// 上传
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});
document.addEventListener('paste', e => {
  const item = e.clipboardData.items[0];
  if (item && item.type.startsWith('image/')) {
    handleFile(item.getAsFile());
  }
});

// 设置面板
paletteMode.addEventListener('change', () => {
  customPaletteInput.classList.toggle('hidden', paletteMode.value !== 'custom');
});
samplingStrength.addEventListener('input', () => samplingValue.textContent = samplingStrength.value);
colorSimplify.addEventListener('input', () => simplifyValue.textContent = colorSimplify.value);
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const size = parseInt(btn.dataset.size);
    customWidth.value = size;
    customHeight.value = size;
    updatePhysicalHint();
  });
});
customWidth.addEventListener('input', updatePhysicalHint);
customHeight.addEventListener('input', updatePhysicalHint);

function updatePhysicalHint() {
  const w = parseInt(customWidth.value) || 29;
  const h = parseInt(customHeight.value) || 29;
  const cmW = (w * 0.5).toFixed(1);
  const cmH = (h * 0.5).toFixed(1);
  physicalHint.textContent = `约 ${cmW}cm × ${cmH}cm（以 5mm 豆计算）`;
}

// 工具切换
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    beadCanvas.style.cursor = state.tool === 'eraser' ? 'cell' : 'crosshair';
  });
});
currentColorInput.addEventListener('input', e => state.currentColor = e.target.value.toUpperCase());
document.getElementById('clearCanvas').addEventListener('click', () => {
  if (!confirm('确定清空当前图纸吗？')) return;
  state.gridData = state.gridData.map(row => row.map(() => '#FFFFFF'));
  renderCanvas();
});

// 画布编辑
beadCanvas.addEventListener('mousedown', startDraw);
beadCanvas.addEventListener('mousemove', draw);
beadCanvas.addEventListener('mouseup', endDraw);
beadCanvas.addEventListener('mouseleave', endDraw);

// 生成按钮
generateBtn.addEventListener('click', generatePattern);

// 导出
document.querySelectorAll('.export-btn').forEach(btn => {
  btn.addEventListener('click', () => exportPattern(btn.dataset.format));
});

// ========== 核心功能 ==========
function handleFile(file) {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
    alert('仅支持 JPG、PNG、WEBP 格式');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过 5MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      state.originalImage = img;
      previewImage.src = e.target.result;
      previewImage.classList.remove('hidden');
      uploadPlaceholder.classList.add('hidden');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function generatePattern() {
  if (!state.originalImage) {
    alert('请先上传图片');
    return;
  }
  generateBtn.disabled = true;
  generateBtn.textContent = '生成中...';

  const w = Math.min(256, Math.max(16, parseInt(customWidth.value) || 29));
  const h = Math.min(256, Math.max(16, parseInt(customHeight.value) || 29));
  state.gridWidth = w;
  state.gridHeight = h;
  state.mirror = mirrorMode.checked;

  // 1. 读取色盘
  let palette = [];
  if (paletteMode.value === 'custom') {
    palette = parseCustomPalette(customColors.value);
    if (palette.length === 0) {
      alert('自定义色盘为空，已回退到智能聚类');
      paletteMode.value = 'smart';
    }
  }
  if (paletteMode.value !== 'custom') {
    palette = PALETTES[paletteMode.value] || [];
  }

  // 2. 图片采样：在隐藏 canvas 上缩放并取色
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const offCtx = off.getContext('2d');
  // 保持比例填充（cover）
  const scale = Math.max(w / state.originalImage.width, h / state.originalImage.height);
  const sw = state.originalImage.width * scale;
  const sh = state.originalImage.height * scale;
  offCtx.drawImage(state.originalImage, (w - sw) / 2, (h - sh) / 2, sw, sh);
  const imageData = offCtx.getImageData(0, 0, w, h);
  const pixels = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
  }

  // 3. 智能聚类生成色盘
  if (paletteMode.value === 'smart') {
    const colorCountTarget = Math.max(5, Math.min(30, Math.floor(30 * (1 - colorSimplify.value / 150))));
    palette = kMeansPalette(pixels, colorCountTarget);
  }
  state.palette = palette;

  // 4. 映射到最近色 + 可选镜像
  state.gridData = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const srcX = state.mirror ? w - 1 - x : x;
      const rgb = pixels[srcX + y * w];
      // 采样强度控制：强度低时向平均值靠拢（简化）
      const strength = samplingStrength.value / 100;
      const avg = pixels.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]).map(v => v / pixels.length);
      const adjusted = rgb.map((v, i) => Math.round(avg[i] + (v - avg[i]) * strength));
      row.push(findClosestColor(adjusted, palette));
    }
    state.gridData.push(row);
  }

  // 5. 渲染
  renderCanvas();
  updateStats();
  editorSection.classList.remove('hidden');
  editorSection.scrollIntoView({ behavior: 'smooth' });
  generateBtn.disabled = false;
  generateBtn.textContent = '立即生成';
}

function renderCanvas() {
  const w = state.gridWidth;
  const h = state.gridHeight;
  // 根据格子数量动态调整 cellSize，保证最大边不超过 800px
  state.cellSize = Math.max(8, Math.min(24, Math.floor(800 / Math.max(w, h))));
  beadCanvas.width = w * state.cellSize;
  beadCanvas.height = h * state.cellSize;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = state.gridData[y][x];
      ctx.fillStyle = color;
      ctx.fillRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
      // 网格线
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
    }
  }
}

function updateStats() {
  const flat = state.gridData.flat();
  const unique = new Set(flat);
  colorCount.textContent = `共 ${unique.size} 色`;
  beadCount.textContent = `共 ${flat.length} 颗豆`;
}

// ========== 画布编辑 ==========
function getCellFromEvent(e) {
  const rect = beadCanvas.getBoundingClientRect();
  const scaleX = beadCanvas.width / rect.width;
  const scaleY = beadCanvas.height / rect.height;
  const x = Math.floor((e.clientX - rect.left) * scaleX / state.cellSize);
  const y = Math.floor((e.clientY - rect.top) * scaleY / state.cellSize);
  return { x, y };
}

function startDraw(e) {
  const { x, y } = getCellFromEvent(e);
  if (x < 0 || x >= state.gridWidth || y < 0 || y >= state.gridHeight) return;

  if (state.tool === 'picker') {
    state.currentColor = state.gridData[y][x];
    currentColorInput.value = state.currentColor;
    return;
  }
  if (state.tool === 'fill') {
    state.fillStart = { x, y };
    return;
  }

  state.isDrawing = true;
  applyTool(x, y);
}

function draw(e) {
  if (!state.isDrawing) return;
  const { x, y } = getCellFromEvent(e);
  if (x < 0 || x >= state.gridWidth || y < 0 || y >= state.gridHeight) return;
  applyTool(x, y);
}

function endDraw(e) {
  if (state.tool === 'fill' && state.fillStart) {
    const { x: x2, y: y2 } = getCellFromEvent(e);
    const { x: x1, y: y1 } = state.fillStart;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x >= 0 && x < state.gridWidth && y >= 0 && y < state.gridHeight) {
          state.gridData[y][x] = state.currentColor;
        }
      }
    }
    renderCanvas();
    updateStats();
    state.fillStart = null;
    return;
  }
  state.isDrawing = false;
}

function applyTool(x, y) {
  if (state.tool === 'brush') {
    state.gridData[y][x] = state.currentColor;
  } else if (state.tool === 'eraser') {
    state.gridData[y][x] = '#FFFFFF';
  }
  // 局部重绘
  ctx.fillStyle = state.gridData[y][x];
  ctx.fillRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.strokeRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
  updateStats();
}

// ========== 导出 ==========
function exportPattern(format) {
  switch (format) {
    case 'png': exportPNG(); break;
    case 'pdf': exportPDF(); break;
    case 'excel': exportExcel(); break;
    case 'svg': exportSVG(); break;
  }
}

function exportPNG() {
  const link = document.createElement('a');
  link.download = `pixelbeads-${state.gridWidth}x${state.gridHeight}.png`;
  link.href = beadCanvas.toDataURL('image/png');
  link.click();
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: state.gridWidth > state.gridHeight ? 'landscape' : 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2 - 30; // 留色标条位置
  const scale = Math.min(maxW / beadCanvas.width, maxH / beadCanvas.height);
  const w = beadCanvas.width * scale;
  const h = beadCanvas.height * scale;
  const x = (pageW - w) / 2;
  const y = margin;
  doc.addImage(beadCanvas.toDataURL('image/png'), 'PNG', x, y, w, h);

  // 色标条
  const legendY = y + h + 10;
  const boxSize = 8;
  const perRow = Math.floor((pageW - margin * 2) / (boxSize + 25));
  state.palette.forEach((hex, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const lx = margin + col * (boxSize + 25);
    const ly = legendY + row * 12;
    doc.setFillColor(hex);
    doc.rect(lx, ly, boxSize, boxSize, 'F');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text(hex, lx + boxSize + 2, ly + boxSize - 1);
  });

  doc.save(`pixelbeads-${state.gridWidth}x${state.gridHeight}.pdf`);
}

function exportExcel() {
  const data = [['行号', '列号', '颜色HEX', '颜色预览']];
  state.gridData.forEach((row, y) => {
    row.forEach((color, x) => {
      data.push([y + 1, x + 1, color, '']);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  // 设置列宽
  ws['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '拼豆图纸');
  XLSX.writeFile(wb, `pixelbeads-${state.gridWidth}x${state.gridHeight}.xlsx`);
}

function exportSVG() {
  const w = state.gridWidth;
  const h = state.gridHeight;
  let rects = '';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = state.gridData[y][x];
      if (color !== '#FFFFFF') {
        rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>\n`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 10}" height="${h * 10}">\n${rects}</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = `pixelbeads-${state.gridWidth}x${state.gridHeight}.svg`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

// 初始化
updatePhysicalHint();
