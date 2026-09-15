// PixelBeads - 拼豆图纸生成器（MARD 264 色卡 + 品牌色卡 + 模板库版）
// 核心逻辑：图片采样、高精度抠图、色彩量化、图纸渲染、编辑与导出

// ========== 全局状态 ==========
const state = {
  originalImage: null,
  gridWidth: 30,
  gridHeight: 30,
  cellSize: 20,
  gridData: [],           // 二维数组，存储每个格子的颜色 hex
  beadData: [],           // 二维数组，存储每个格子的豆号 id
  palette: [],            // 当前使用的色卡数组 [{id, hex, name, special}]
  tool: 'brush',          // brush | fill | eraser | picker
  currentColor: '#FF0000',
  currentBeadId: '-',
  isDrawing: false,
  fillStart: null,
  mirror: false,
  transparentBg: true,    // 背景透明
  cutoutPrecision: 'balanced' // fast | balanced | precise
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
const cutoutPrecision = document.getElementById('cutoutPrecision');
const samplingStrength = document.getElementById('samplingStrength');
const colorSimplify = document.getElementById('colorSimplify');
const samplingValue = document.getElementById('samplingValue');
const simplifyValue = document.getElementById('simplifyValue');
const physicalHint = document.getElementById('physicalHint');
const customWidth = document.getElementById('customWidth');
const customHeight = document.getElementById('customHeight');
const colorCount = document.getElementById('colorCount');
const beadCount = document.getElementById('beadCount');
const usedColorCount = document.getElementById('usedColorCount');
const currentColorInput = document.getElementById('currentColor');
const currentBeadId = document.getElementById('currentBeadId');
const mirrorMode = document.getElementById('mirrorMode');
const colorTable = document.getElementById('colorTable');
const templateGrid = document.getElementById('templateGrid');

// ========== 颜色工具 ==========
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const v = Math.max(0, Math.min(255, Math.round(x)));
    return v.toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

function colorDistance(c1, c2) {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

function findClosestBead(rgb, palette) {
  let minDist = Infinity;
  let closest = palette[0];
  for (const bead of palette) {
    if (bead.special === 'transparent') continue;
    const dist = colorDistance(rgb, hexToRgb(bead.hex));
    if (dist < minDist) {
      minDist = dist;
      closest = bead;
    }
  }
  return closest;
}

// K-means 聚类生成智能色盘
function kMeansPalette(pixels, k) {
  if (pixels.length === 0) return MARD_264.slice(0, k);
  let centroids = [];
  const step = Math.max(1, Math.floor(pixels.length / k));
  for (let i = 0; i < k && i * step < pixels.length; i++) {
    centroids.push([...pixels[i * step]]);
  }
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
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        const sum = clusters[i].reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
        centroids[i] = sum.map(v => Math.round(v / clusters[i].length));
      }
    }
  }
  return centroids.map(c => {
    const hex = rgbToHex(c[0], c[1], c[2]);
    return findClosestBead(c, MARD_264);
  });
}

// ========== 高精度自动抠图 ==========
// 改进：多尺度边缘检测 + 自适应阈值 + 形态学优化 + 边缘羽化
function autoCutout(imageData, precision = 'balanced') {
  const { width, height, data } = imageData;
  const w = width, h = height;
  
  // 根据精度调整参数
  const config = {
    fast:     { edgeThresh: 80, colorThresh: 60, morphIter: 1, feather: 0 },
    balanced: { edgeThresh: 60, colorThresh: 45, morphIter: 2, feather: 1 },
    precise:  { edgeThresh: 40, colorThresh: 30, morphIter: 3, feather: 2 }
  }[precision] || { edgeThresh: 60, colorThresh: 45, morphIter: 2, feather: 1 };

  // 1. 多尺度 Sobel 边缘检测（3x3 + 5x5 融合）
  const edgeMap = new Float32Array(w * h);
  
  // 3x3 Sobel
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0;
      // Sobel X: [-1 0 1; -2 0 2; -1 0 1]
      // Sobel Y: [-1 -2 -1; 0 0 0; 1 2 1]
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4;
          const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1][(dy + 1) * 3 + (dx + 1)];
          const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1][(dy + 1) * 3 + (dx + 1)];
          gx += gray * kx;
          gy += gray * ky;
        }
      }
      edgeMap[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  
  // 5x5 高斯模糊后边缘（用于检测柔和边缘）
  if (precision !== 'fast') {
    const blurred = new Float32Array(w * h);
    const gauss = [1, 4, 6, 4, 1];
    const gaussSum = 256; // (1+4+6+4+1)^2
    
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        let sum = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const i = ((y + dy) * w + (x + dx)) * 4;
            const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            sum += gray * gauss[dx + 2] * gauss[dy + 2];
          }
        }
        blurred[y * w + x] = sum / gaussSum;
      }
    }
    
    // 融合模糊边缘
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        const gx = Math.abs(blurred[i] - blurred[i - 1]) + Math.abs(blurred[i] - blurred[i + 1]);
        const gy = Math.abs(blurred[i] - blurred[i - w]) + Math.abs(blurred[i] - blurred[i + w]);
        edgeMap[i] = Math.max(edgeMap[i], (gx + gy) * 0.7);
      }
    }
  }
  
  // 2. 自适应阈值：基于边缘强度直方图
  const edgeValues = Array.from(edgeMap).filter(v => v > 0).sort((a, b) => a - b);
  const median = edgeValues[Math.floor(edgeValues.length / 2)] || 50;
  const adaptiveThresh = Math.max(config.edgeThresh, median * 0.8);
  
  const edges = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    edges[i] = edgeMap[i] > adaptiveThresh ? 1 : 0;
  }
  
  // 3. 边缘连接：膨胀桥接断点
  let dilated = new Uint8Array(edges);
  for (let iter = 0; iter < config.morphIter; iter++) {
    const next = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (dilated[y * w + x]) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              next[(y + dy) * w + (x + dx)] = 1;
            }
          }
        }
      }
    }
    dilated = next;
  }
  
  // 4. 背景色估计：K-means 聚类边缘像素
  const bgSamples = [];
  const margin = Math.max(3, Math.floor(Math.min(w, h) * 0.03));
  
  // 四边采样
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < margin; y++) {
      const i = (y * w + x) * 4;
      bgSamples.push([data[i], data[i + 1], data[i + 2]]);
    }
    for (let y = h - margin; y < h; y++) {
      const i = (y * w + x) * 4;
      bgSamples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < margin; x++) {
      const i = (y * w + x) * 4;
      bgSamples.push([data[i], data[i + 1], data[i + 2]]);
    }
    for (let x = w - margin; x < w; x++) {
      const i = (y * w + x) * 4;
      bgSamples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  
  // 简单 K-means 找主背景色（k=2，取较大簇）
  let bgColor;
  if (bgSamples.length > 10 && precision === 'precise') {
    const clusters = kMeansPalette(bgSamples, 2);
    // 用簇大小决定主背景
    const c1 = bgSamples.filter(p => colorDistance(p, hexToRgb(clusters[0].hex)) < 30).length;
    const c2 = bgSamples.filter(p => colorDistance(p, hexToRgb(clusters[1].hex)) < 30).length;
    bgColor = hexToRgb(c1 > c2 ? clusters[0].hex : clusters[1].hex);
  } else {
    // 直接平均
    bgColor = bgSamples.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0])
      .map(v => v / bgSamples.length);
  }
  
  // 5. 主体标记：边缘内 + 颜色差异
  const colorThresh = config.colorThresh;
  let mask = new Uint8Array(w * h);
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const dist = Math.sqrt(
        2 * (r - bgColor[0]) ** 2 + 
        4 * (g - bgColor[1]) ** 2 + 
        3 * (b - bgColor[2]) ** 2
      );
      // 边缘膨胀区域内，或者颜色与背景差异大
      if (dilated[y * w + x] || dist > colorThresh) {
        mask[y * w + x] = 1;
      }
    }
  }
  
  // 6. 形态学优化：先腐蚀去噪，再膨胀恢复
  for (let iter = 0; iter < config.morphIter; iter++) {
    // 腐蚀
    const eroded = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += mask[(y + dy) * w + (x + dx)];
          }
        }
        eroded[y * w + x] = sum >= 5 ? 1 : 0;
      }
    }
    mask = eroded;
    
    // 膨胀
    const dilated2 = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (mask[y * w + x]) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              dilated2[(y + dy) * w + (x + dx)] = 1;
            }
          }
        }
      }
    }
    mask = dilated2;
  }
  
  // 7. 边缘羽化：高斯模糊 mask 边缘
  if (config.feather > 0) {
    const feathered = new Float32Array(w * h);
    const f = config.feather;
    for (let y = f; y < h - f; y++) {
      for (let x = f; x < w - f; x++) {
        let sum = 0, count = 0;
        for (let dy = -f; dy <= f; dy++) {
          for (let dx = -f; dx <= f; dx++) {
            sum += mask[(y + dy) * w + (x + dx)];
            count++;
          }
        }
        feathered[y * w + x] = sum / count;
      }
    }
    // 边缘区域保留原值，中心区域用羽化值
    for (let i = 0; i < w * h; i++) {
      if (feathered[i] > 0 && feathered[i] < 1) {
        mask[i] = feathered[i] > 0.5 ? 1 : 0;
      }
    }
  }
  
  return { mask, bgColor };
}

// ========== 事件绑定 ==========
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

paletteMode.addEventListener('change', () => {
  customPaletteInput.classList.toggle('hidden', paletteMode.value !== 'custom');
});
cutoutPrecision.addEventListener('change', () => {
  state.cutoutPrecision = cutoutPrecision.value;
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
  const w = parseInt(customWidth.value) || 30;
  const h = parseInt(customHeight.value) || 30;
  const cmW = (w * 0.5).toFixed(1);
  const cmH = (h * 0.5).toFixed(1);
  physicalHint.textContent = `约 ${cmW}cm × ${cmH}cm（以 5mm 豆计算）`;
}

document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    beadCanvas.style.cursor = state.tool === 'eraser' ? 'cell' : 'crosshair';
  });
});
currentColorInput.addEventListener('input', e => {
  state.currentColor = e.target.value.toUpperCase();
  const bead = state.palette.find(b => b.hex === state.currentColor);
  state.currentBeadId = bead ? bead.id : '-';
  currentBeadId.textContent = `豆号: ${state.currentBeadId}`;
});
document.getElementById('clearCanvas').addEventListener('click', () => {
  if (!confirm('确定清空当前图纸吗？')) return;
  state.gridData = state.gridData.map(row => row.map(() => null));
  state.beadData = state.beadData.map(row => row.map(() => null));
  renderCanvas();
});

beadCanvas.addEventListener('mousedown', startDraw);
beadCanvas.addEventListener('mousemove', draw);
beadCanvas.addEventListener('mouseup', endDraw);
beadCanvas.addEventListener('mouseleave', endDraw);

generateBtn.addEventListener('click', generatePattern);

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

function getPalette() {
  const mode = paletteMode.value;
  switch (mode) {
    case 'mard264': return MARD_264;
    case 'hama': return HAMA_COLORS;
    case 'perler': return PERLER_COLORS;
    case 'artkal': return ARTKAL_COLORS;
    case 'nabbi': return NABBI_COLORS;
    case 'perler-mini': return PERLER_MINI_COLORS;
    case 'custom': {
      const custom = parseCustomPalette(customColors.value);
      if (custom.length === 0) {
        alert('自定义色盘为空，已回退到 MARD 264');
        paletteMode.value = 'mard264';
        return MARD_264;
      }
      return custom.map((hex, i) => ({ id: `C${i + 1}`, hex, name: '自定义' }));
    }
    case 'smart':
    default:
      return MARD_264; // smart 会在生成时动态计算
  }
}

function generatePattern() {
  if (!state.originalImage) {
    alert('请先上传图片');
    return;
  }
  generateBtn.disabled = true;
  generateBtn.textContent = '生成中...';

  const w = Math.min(256, Math.max(16, parseInt(customWidth.value) || 30));
  const h = Math.min(256, Math.max(16, parseInt(customHeight.value) || 30));
  state.gridWidth = w;
  state.gridHeight = h;
  state.mirror = mirrorMode.checked;
  state.cutoutPrecision = cutoutPrecision.value;

  // 1. 选择色卡
  let palette = getPalette();
  const isSmart = paletteMode.value === 'smart';

  // 2. 图片采样到目标尺寸
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const offCtx = off.getContext('2d');
  const scale = Math.max(w / state.originalImage.width, h / state.originalImage.height);
  const sw = state.originalImage.width * scale;
  const sh = state.originalImage.height * scale;
  offCtx.drawImage(state.originalImage, (w - sw) / 2, (h - sh) / 2, sw, sh);
  const imageData = offCtx.getImageData(0, 0, w, h);

  // 3. 高精度自动抠图
  const cutout = autoCutout(imageData, state.cutoutPrecision);

  // 4. 提取主体像素
  const pixels = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    pixels.push([imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]]);
  }

  // 5. 智能聚类
  if (isSmart) {
    const colorCountTarget = Math.max(5, Math.min(30, Math.floor(30 * (1 - colorSimplify.value / 150))));
    palette = kMeansPalette(pixels, colorCountTarget);
  }
  state.palette = palette;

  // 6. 映射到色卡 + 抠图背景透明
  state.gridData = [];
  state.beadData = [];
  const avg = pixels.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]).map(v => v / pixels.length);
  
  for (let y = 0; y < h; y++) {
    const row = [];
    const beadRow = [];
    for (let x = 0; x < w; x++) {
      const srcX = state.mirror ? w - 1 - x : x;
      const idx = srcX + y * w;
      const rgb = pixels[idx];
      const strength = samplingStrength.value / 100;
      const adjusted = rgb.map((v, i) => Math.round(avg[i] + (v - avg[i]) * strength));
      
      // 抠图：背景区域标记为透明
      if (cutout.mask[idx] === 0 && state.transparentBg) {
        row.push(null);
        beadRow.push(null);
      } else {
        const bead = findClosestBead(adjusted, palette);
        row.push(bead.hex);
        beadRow.push(bead.id);
      }
    }
    state.gridData.push(row);
    state.beadData.push(beadRow);
  }

  // 7. 渲染
  renderCanvas();
  renderColorTable();
  updateStats();
  editorSection.classList.remove('hidden');
  editorSection.scrollIntoView({ behavior: 'smooth' });
  generateBtn.disabled = false;
  generateBtn.textContent = '立即生成';
}

function renderCanvas() {
  const w = state.gridWidth;
  const h = state.gridHeight;
  state.cellSize = Math.max(8, Math.min(24, Math.floor(800 / Math.max(w, h))));
  beadCanvas.width = w * state.cellSize;
  beadCanvas.height = h * state.cellSize;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = state.gridData[y][x];
      if (color === null) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e8e8e8' : '#ffffff';
      } else {
        ctx.fillStyle = color;
      }
      ctx.fillRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
    }
  }
}

function renderColorTable() {
  colorTable.innerHTML = '';
  const usedBeads = new Set();
  state.beadData.flat().forEach(id => { if (id) usedBeads.add(id); });
  
  const showAll = state.palette.length <= 64;
  const beadsToShow = showAll ? state.palette : state.palette.filter(b => usedBeads.has(b.id));
  
  beadsToShow.forEach(bead => {
    const item = document.createElement('div');
    item.className = 'color-item';
    if (usedBeads.has(bead.id)) item.classList.add('used');
    if (bead.special === 'transparent') item.classList.add('transparent');
    
    const isLight = isLightColor(bead.hex);
    item.innerHTML = `
      <div class="color-swatch" style="background:${bead.hex}; color:${isLight ? '#000' : '#fff'}">
        ${bead.id}
      </div>
      <div class="color-name">${bead.name}</div>
    `;
    item.title = `${bead.id} ${bead.name} ${bead.hex}`;
    item.addEventListener('click', () => {
      state.currentColor = bead.hex;
      state.currentBeadId = bead.id;
      currentColorInput.value = bead.hex;
      currentBeadId.textContent = `豆号: ${bead.id}`;
    });
    colorTable.appendChild(item);
  });
  
  usedColorCount.textContent = `已用 ${usedBeads.size} 色`;
}

function isLightColor(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 150;
}

function updateStats() {
  const flat = state.gridData.flat();
  const valid = flat.filter(c => c !== null);
  const unique = new Set(valid);
  colorCount.textContent = `共 ${unique.size} 色`;
  beadCount.textContent = `共 ${valid.length} 颗豆`;
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
    const color = state.gridData[y][x];
    if (color) {
      state.currentColor = color;
      state.currentBeadId = state.beadData[y][x] || '-';
      currentColorInput.value = color;
      currentBeadId.textContent = `豆号: ${state.currentBeadId}`;
    }
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
          state.beadData[y][x] = state.currentBeadId;
        }
      }
    }
    renderCanvas();
    renderColorTable();
    updateStats();
    state.fillStart = null;
    return;
  }
  state.isDrawing = false;
}

function applyTool(x, y) {
  if (state.tool === 'brush') {
    state.gridData[y][x] = state.currentColor;
    state.beadData[y][x] = state.currentBeadId;
  } else if (state.tool === 'eraser') {
    state.gridData[y][x] = null;
    state.beadData[y][x] = null;
  }
  const color = state.gridData[y][x];
  if (color === null) {
    ctx.fillStyle = (x + y) % 2 === 0 ? '#e8e8e8' : '#ffffff';
  } else {
    ctx.fillStyle = color;
  }
  ctx.fillRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.strokeRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
  updateStats();
}

// ========== 导出 ==========
function exportPattern(format) {
  switch (format) {
    case 'png': exportPNG(); break;
    case 'jpg': exportJPG(); break;
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

function exportJPG() {
  const temp = document.createElement('canvas');
  temp.width = beadCanvas.width;
  temp.height = beadCanvas.height;
  const tctx = temp.getContext('2d');
  tctx.fillStyle = '#FFFFFF';
  tctx.fillRect(0, 0, temp.width, temp.height);
  tctx.drawImage(beadCanvas, 0, 0);
  
  const link = document.createElement('a');
  link.download = `pixelbeads-${state.gridWidth}x${state.gridHeight}.jpg`;
  link.href = temp.toDataURL('image/jpeg', 0.95);
  link.click();
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: state.gridWidth > state.gridHeight ? 'landscape' : 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2 - 40;
  const scale = Math.min(maxW / beadCanvas.width, maxH / beadCanvas.height);
  const w = beadCanvas.width * scale;
  const h = beadCanvas.height * scale;
  const x = (pageW - w) / 2;
  const y = margin;
  doc.addImage(beadCanvas.toDataURL('image/png'), 'PNG', x, y, w, h);

  const usedBeads = new Set();
  state.beadData.flat().forEach(id => { if (id) usedBeads.add(id); });
  const beads = state.palette.filter(b => usedBeads.has(b.id));
  
  let legendY = y + h + 8;
  const boxSize = 8;
  const perRow = Math.floor((pageW - margin * 2) / 45);
  beads.forEach((bead, i) => {
    if (legendY > pageH - margin - 10) {
      doc.addPage();
      legendY = margin;
    }
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const lx = margin + col * 45;
    const ly = legendY + row * 14;
    
    doc.setFillColor(bead.hex);
    doc.rect(lx, ly, boxSize, boxSize, 'F');
    doc.setFontSize(7);
    doc.setTextColor(0);
    doc.text(`${bead.id} ${bead.name}`, lx + boxSize + 2, ly + boxSize - 1);
  });

  doc.save(`pixelbeads-${state.gridWidth}x${state.gridHeight}.pdf`);
}

function exportExcel() {
  const data = [['行号', '列号', '豆号', '颜色HEX', '颜色名称']];
  state.gridData.forEach((row, y) => {
    row.forEach((color, x) => {
      const beadId = state.beadData[y][x];
      const bead = state.palette.find(b => b.id === beadId) || { name: '透明' };
      data.push([y + 1, x + 1, beadId || '透明', color || '透明', bead.name]);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
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
      if (color) {
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

function parseCustomPalette(text) {
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => /^#[0-9A-Fa-f]{6}$/.test(line));
}

// ========== 模板库 ==========
function renderTemplates() {
  if (!templateGrid) return;
  templateGrid.innerHTML = '';
  
  // 按分类分组
  const categories = {};
  TEMPLATES.forEach(t => {
    if (!categories[t.category]) categories[t.category] = [];
    categories[t.category].push(t);
  });
  
  Object.entries(categories).forEach(([cat, templates]) => {
    const catTitle = document.createElement('div');
    catTitle.className = 'template-category';
    catTitle.textContent = cat;
    templateGrid.appendChild(catTitle);
    
    templates.forEach(t => {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.innerHTML = `
        <div class="template-preview" data-template="${t.name}"></div>
        <div class="template-name">${t.name}</div>
        <div class="template-size">${t.size[0]}×${t.size[1]}</div>
      `;
      
      // 渲染预览
      const preview = card.querySelector('.template-preview');
      const canvas = document.createElement('canvas');
      canvas.width = t.size[0] * 4;
      canvas.height = t.size[1] * 4;
      const pctx = canvas.getContext('2d');
      
      t.data.forEach((row, y) => {
        row.forEach((beadId, x) => {
          if (beadId) {
            const bead = MARD_264.find(b => b.id === beadId);
            if (bead) {
              pctx.fillStyle = bead.hex;
              pctx.fillRect(x * 4, y * 4, 4, 4);
            }
          }
        });
      });
      
      preview.appendChild(canvas);
      card.addEventListener('click', () => loadTemplate(t));
      templateGrid.appendChild(card);
    });
  });
}

function loadTemplate(template) {
  const [w, h] = template.size;
  state.gridWidth = w;
  state.gridHeight = h;
  state.palette = MARD_264;
  
  state.gridData = [];
  state.beadData = [];
  
  template.data.forEach(row => {
    const gridRow = [];
    const beadRow = [];
    row.forEach(beadId => {
      if (beadId) {
        const bead = MARD_264.find(b => b.id === beadId);
        gridRow.push(bead ? bead.hex : null);
        beadRow.push(beadId);
      } else {
        gridRow.push(null);
        beadRow.push(null);
      }
    });
    state.gridData.push(gridRow);
    state.beadData.push(beadRow);
  });
  
  customWidth.value = w;
  customHeight.value = h;
  updatePhysicalHint();
  renderCanvas();
  renderColorTable();
  updateStats();
  editorSection.classList.remove('hidden');
  editorSection.scrollIntoView({ behavior: 'smooth' });
}

// ========== PWA 注册 ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('SW registration failed:', err);
    });
  });
}

// 初始化
updatePhysicalHint();
renderTemplates();
