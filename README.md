# PixelBeads · 拼豆图纸生成器

一个免费、免注册、纯前端的在线拼豆图纸生成工具，把照片一键转换为像素拼豆图纸。

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## ✨ 功能特性

### 🖼️ 图片转图纸
- 支持 **JPG / PNG / WEBP** 格式，单张最大 **5MB**
- 点击 / 拖拽 / **粘贴剪贴板截图** 即时识别转换
- 可调节 **采样强度** 与 **色彩简化等级**，让照片更贴合小颗粒拼豆的表现力

### 📐 画布尺寸
- 常用规格预设：29×29、30×30、40×40、48×48
- 自定义任意行列（**16×16 至 256×256**）
- 每档标注对应物理尺寸参考，适配 Perler、Artkal、Nabbi 等主流拼豆底板

### 🎨 色彩管理
- 内置 **120+ 种标准色号**
- 三种映射模式：
  - **智能聚类**（K-means 自动提取主色）
  - **品牌直连**（Perler / Artkal / Nabbi 厂商色卡）
  - **自定义色盘**（支持导入 HEX 色值）

### ✏️ 编辑工具
- 画笔填色、矩形填充、橡皮擦修正
- **抓色填色**：从图纸任意位置取色
- **反向图纸生成**：支持镜像 / 双面作品
- 实时统计色号数量与总豆数

### 📤 导出格式
| 格式 | 说明 |
|------|------|
| **PDF** | A4 打印友好，自带色标条 |
| **PNG** | 高清位图，适配投影辅助 |
| **Excel** | 含行列坐标与色号，方便对照拼豆 |
| **SVG** | 矢量格式，兼容 Cricut 等切割设备 |

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
├── app.js          # 核心逻辑（采样/量化/渲染/编辑/导出）
└── README.md
```

纯静态实现，仅通过 CDN 引入 [jsPDF](https://github.com/parallax/jsPDF)（PDF 导出）和 [SheetJS](https://sheetjs.com/)（Excel 导出）。

## 🛠️ 技术要点

- **图片采样**：Canvas 等比缩放（cover）+ `getImageData` 像素读取
- **色彩量化**：K-means 聚类 / 品牌色卡最近色匹配（加权欧氏距离，模拟人眼感知）
- **编辑渲染**：像素化 Canvas 渲染（`image-rendering: pixelated`），局部增量重绘
- **导出**：jsPDF 生成带色标条的 PDF；SheetJS 生成坐标色号表；手工拼接 SVG

## 📄 License

MIT License
