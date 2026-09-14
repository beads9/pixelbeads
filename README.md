# PixelBeads · 拼豆图纸生成器

免费、免注册、纯前端的在线拼豆图纸生成工具，把照片一键转换为像素拼豆图纸。

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=white)

## ✨ 功能特性

### 🖼️ 图片转图纸
- 支持 **JPG / PNG / WEBP** 格式，单张最大 **5MB**
- 点击 / 拖拽 / **粘贴剪贴板截图** 即时识别转换
- **自动抠图**：智能识别主体，背景透明无需填充
- 可调节 **采样强度** 与 **色彩简化等级**

### ✂️ 自动抠图
- 边缘检测 + 背景色估计，自动提取主体
- 背景区域标记为透明，图纸渲染时显示棋盘格
- 导出 PNG 保留透明通道，导出 JPG 自动填充白底

### 📐 画布尺寸
- 常用规格预设：30×30、40×40、48×48、52×52、64×64
- 自定义任意行列（**16×16 至 256×256**）
- 每档标注对应物理尺寸参考

### 🎨 色卡系统
| 色卡 | 说明 |
|------|------|
| **MARD 264** | 完整 MARD 2.6mm 融合豆 264 色卡，含全部豆号 |
| **HAMA** | HAMA 官方标准色卡 30 色 |
| **智能聚类** | K-means 自动提取主色，映射到 MARD 色卡 |
| **自定义** | 支持导入 HEX 色值自定义色盘 |

#### MARD 264 色卡系列
- **A系列**：黄橙系（A1-A26）
- **B系列**：绿色系（B1-B32）
- **C系列**：蓝青系（C1-C29）
- **D系列**：蓝紫/紫色系（D1-D26）
- **E系列**：粉色系（E1-E24）
- **F系列**：红/橙红系（F1-F25）
- **G系列**：棕/肤色/大地系（G1-G21）
- **H系列**：灰白黑中性系（H1-H23，含 H1 透明）
- **M系列**：灰调大地/莫兰迪系（M1-M15）
- **P系列**：混合彩色系（P1-P23）
- **R系列**：高饱和常用纯色（R1-R13）
- **Y系列**：浅色糖果系（Y1-Y5）
- **Q系列**：Q2、Q5
- **T系列**：T1 葱粉（特殊闪粉材质）

### ✏️ 编辑工具
- 画笔填色、矩形填充、橡皮擦修正
- **抓色填色**：从图纸任意位置取色，自动识别豆号
- **色号对照表**：可视化色板，点击设为当前色，标注已用颜色
- **反向图纸生成**：支持镜像 / 双面作品
- 实时统计色号数量、总豆数、已用颜色数

### 📤 导出格式
| 格式 | 说明 |
|------|------|
| **PNG** | 透明背景，高清位图 |
| **JPG** | 白底高清，适配打印 |
| **PDF** | A4 打印友好，自带色号对照表 |
| **Excel** | 含行列坐标、豆号、颜色 HEX、颜色名称 |
| **SVG** | 矢量格式，兼容 Cricut 等切割设备 |

### 📱 PWA 离线支持
- 添加到主屏幕，像原生 App 一样使用
- Service Worker 缓存，离线可用
- 自动缓存 MARD 264 色卡数据

## 🚀 在线使用

直接用浏览器打开 `index.html` 即可使用，无需安装、无需注册、无需后端。

也可通过 GitHub Pages 访问在线版本：`https://<用户名>.github.io/<仓库名>/`

## 💻 本地运行

```bash
# 克隆仓库
git clone https://github.com/<用户名>/<仓库名>.git
cd <仓库名>

# 直接用浏览器打开
open index.html        # macOS
# 或启动本地服务
python3 -m http.server 8000
# 访问 http://localhost:8000
```

## 📁 项目结构

```
├── index.html      # 页面结构
├── style.css       # 样式
├── app.js          # 核心逻辑（采样/抠图/量化/渲染/编辑/导出）
├── mard264.js      # MARD 264 色卡 + HAMA 色卡数据
├── manifest.json   # PWA 配置
├── sw.js           # Service Worker（离线缓存）
└── README.md
```

纯静态实现，仅通过 CDN 引入 [jsPDF](https://github.com/parallax/jsPDF)（PDF 导出）和 [SheetJS](https://sheetjs.com/)（Excel 导出）。

## 🛠️ 技术要点

- **图片采样**：Canvas 等比缩放（cover）+ `getImageData` 像素读取
- **自动抠图**：边缘检测 + 背景色估计 + 形态学膨胀腐蚀，提取主体区域
- **色彩量化**：K-means 聚类 / MARD 264 最近色匹配（加权欧氏距离，模拟人眼感知）
- **编辑渲染**：像素化 Canvas 渲染（`image-rendering: pixelated`），局部增量重绘，透明区域棋盘格显示
- **色号对照**：可视化色板展示 MARD 264 全系列，实时标注已用颜色
- **导出**：jsPDF 生成带色号对照表的 PDF；SheetJS 生成含豆号的坐标表；手工拼接 SVG
- **PWA**：manifest + Service Worker 实现离线访问和主屏幕安装

## 📄 License

MIT License
