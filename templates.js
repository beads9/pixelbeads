// 内置图纸模板库
// 每个模板包含：name（名称）、size（尺寸）、data（豆号二维数组，null 表示透明）

const TEMPLATES = [
  {
    name: '爱心',
    category: '基础图形',
    size: [20, 20],
    palette: 'mard264',
    data: (() => {
      const s = 20, grid = [];
      for (let y = 0; y < s; y++) {
        const row = [];
        for (let x = 0; x < s; x++) {
          // 爱心方程
          const nx = (x - s/2) / (s/2) * 1.2;
          const ny = (y - s/2) / (s/2) * 1.2;
          const a = nx*nx + ny*ny - 1;
          const inside = (a*a*a - nx*nx*ny*ny*ny) < 0;
          row.push(inside ? 'F4' : null); // 正红
        }
        grid.push(row);
      }
      return grid;
    })()
  },
  {
    name: '星星',
    category: '基础图形',
    size: [20, 20],
    palette: 'mard264',
    data: (() => {
      const s = 20, grid = [];
      const cx = s/2, cy = s/2, R = 8, r = 3.5;
      for (let y = 0; y < s; y++) {
        const row = [];
        for (let x = 0; x < s; x++) {
          let inside = false;
          for (let i = 0; i < 5; i++) {
            const a1 = -Math.PI/2 + i * 2 * Math.PI / 5;
            const a2 = a1 + Math.PI / 5;
            const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
            const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
            const x3 = cx + R * Math.cos(a1 + 2*Math.PI/5), y3 = cy + R * Math.sin(a1 + 2*Math.PI/5);
            // 点在三角形内
            const d1 = (x - x2)*(y1 - y2) - (x1 - x2)*(y - y2);
            const d2 = (x - x3)*(y2 - y3) - (x2 - x3)*(y - y3);
            const d3 = (x - x1)*(y3 - y1) - (x3 - x1)*(y - y1);
            const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
            const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
            if (!(hasNeg && hasPos)) inside = true;
          }
          row.push(inside ? 'A4' : null); // 明黄
        }
        grid.push(row);
      }
      return grid;
    })()
  },
  {
    name: '字母 A',
    category: '字母数字',
    size: [16, 16],
    palette: 'mard264',
    data: (() => {
      const pattern = [
        '....XXXX........',
        '...XX..XX.......',
        '..XX....XX......',
        '..XX....XX......',
        '..XXXXXXXX......',
        '..XX....XX......',
        '..XX....XX......',
        '..XX....XX......',
        '..XX....XX......',
        '..XX....XX......',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................'
      ];
      return pattern.map(row => 
        row.split('').map(c => c === 'X' ? 'C8' : null) // 亮蓝
      );
    })()
  },
  {
    name: '字母 B',
    category: '字母数字',
    size: [16, 16],
    palette: 'mard264',
    data: (() => {
      const pattern = [
        '..XXXXXX........',
        '..XX....XX......',
        '..XX....XX......',
        '..XX...XX.......',
        '..XXXXXX........',
        '..XX....XX......',
        '..XX.....XX.....',
        '..XX.....XX.....',
        '..XX....XX......',
        '..XXXXXX........',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................'
      ];
      return pattern.map(row => 
        row.split('').map(c => c === 'X' ? 'B8' : null) // 深绿
      );
    })()
  },
  {
    name: '数字 1',
    category: '字母数字',
    size: [16, 16],
    palette: 'mard264',
    data: (() => {
      const pattern = [
        '....XX..........',
        '...XXX..........',
        '..XXXX..........',
        '....XX..........',
        '....XX..........',
        '....XX..........',
        '....XX..........',
        '....XX..........',
        '....XX..........',
        '..XXXXXX........',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................'
      ];
      return pattern.map(row => 
        row.split('').map(c => c === 'X' ? 'F4' : null) // 正红
      );
    })()
  },
  {
    name: '小猫',
    category: '动物',
    size: [24, 24],
    palette: 'mard264',
    data: (() => {
      const s = 24, grid = [];
      // 简化的猫头轮廓
      for (let y = 0; y < s; y++) {
        const row = [];
        for (let x = 0; x < s; x++) {
          let bead = null;
          // 耳朵
          if ((x >= 4 && x <= 8 && y >= 2 && y <= 6) || (x >= 15 && x <= 19 && y >= 2 && y <= 6)) {
            bead = 'G7'; // 棕
          }
          // 脸
          if (x >= 5 && x <= 18 && y >= 5 && y <= 18) {
            bead = 'G2'; // 浅杏
          }
          // 眼睛
          if ((x >= 8 && x <= 10 && y >= 9 && y <= 11) || (x >= 14 && x <= 16 && y >= 9 && y <= 11)) {
            bead = 'H7'; // 黑
          }
          // 鼻子
          if (x >= 11 && x <= 13 && y >= 13 && y <= 14) {
            bead = 'F9'; // 粉红
          }
          row.push(bead);
        }
        grid.push(row);
      }
      return grid;
    })()
  },
  {
    name: '花朵',
    category: '植物',
    size: [20, 20],
    palette: 'mard264',
    data: (() => {
      const s = 20, grid = [];
      const cx = s/2, cy = s/2;
      for (let y = 0; y < s; y++) {
        const row = [];
        for (let x = 0; x < s; x++) {
          let bead = null;
          const dx = x - cx, dy = y - cy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const angle = Math.atan2(dy, dx);
          // 花瓣（5瓣）
          const petal = Math.cos(angle * 5) * 3 + 4;
          if (dist < petal && dist > 2) {
            bead = 'E5'; // 玫粉
          }
          // 花心
          if (dist <= 2.5) {
            bead = 'A4'; // 明黄
          }
          // 茎
          if (x >= cx-1 && x <= cx+1 && y > cy + 4 && y < s - 2) {
            bead = 'B5'; // 草绿
          }
          row.push(bead);
        }
        grid.push(row);
      }
      return grid;
    })()
  },
  {
    name: '圣诞树',
    category: '节日',
    size: [24, 24],
    palette: 'mard264',
    data: (() => {
      const s = 24, grid = [];
      for (let y = 0; y < s; y++) {
        const row = [];
        for (let x = 0; x < s; x++) {
          let bead = null;
          const cx = s/2;
          // 三层树冠
          if (y >= 3 && y <= 8 && Math.abs(x - cx) < (y - 2)) bead = 'B15'; // 深草绿
          if (y >= 8 && y <= 13 && Math.abs(x - cx) < (y - 6)) bead = 'B8';  // 深绿
          if (y >= 13 && y <= 18 && Math.abs(x - cx) < (y - 10)) bead = 'B5'; // 草绿
          // 树干
          if (y >= 18 && y <= 21 && x >= cx - 2 && x <= cx + 2) bead = 'G8'; // 深棕
          // 星星
          if (y <= 3 && Math.abs(x - cx) + Math.abs(y - 2) < 2) bead = 'A4'; // 明黄
          row.push(bead);
        }
        grid.push(row);
      }
      return grid;
    })()
  },
  {
    name: '雪花',
    category: '节日',
    size: [20, 20],
    palette: 'mard264',
    data: (() => {
      const s = 20, grid = [];
      const cx = s/2, cy = s/2;
      for (let y = 0; y < s; y++) {
        const row = [];
        for (let x = 0; x < s; x++) {
          let bead = null;
          const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
          // 六角雪花
          if (dx === 0 || dy === 0 || dx === dy) {
            if (dx + dy < 8) bead = 'C24'; // 浅蓝
          }
          if (dx < 2 && dy < 2) bead = 'C24';
          row.push(bead);
        }
        grid.push(row);
      }
      return grid;
    })()
  },
  {
    name: '彩虹',
    category: '风景',
    size: [30, 20],
    palette: 'mard264',
    data: (() => {
      const w = 30, h = 20, grid = [];
      const colors = ['F4', 'A7', 'A4', 'B5', 'C8', 'D6']; // 红橙黄绿蓝紫
      for (let y = 0; y < h; y++) {
        const row = [];
        for (let x = 0; x < w; x++) {
          let bead = null;
          const cx = w/2, cy = h - 2;
          const dist = Math.sqrt((x - cx)**2 + (y - cy)**2);
          const band = Math.floor(dist / 3);
          if (band >= 2 && band < 8 && y < h - 2) {
            bead = colors[band - 2] || null;
          }
          row.push(bead);
        }
        grid.push(row);
      }
      return grid;
    })()
  },
];

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TEMPLATES };
}
