# kevi_nya

![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-active-brightgreen)

> 🌸 属于 kevi_nya 的温柔、治愈、有猫系灵魂的个人数字花园。

一个纯静态的个人主页网站，日系治愈风格，支持访客专属页面与公开主页双模式切换。可直接部署到 GitHub Pages。

## ✨ 特性

- **双页面模式** — URL 参数 `?from=4b68ab3847feda7d` 触发访客专属页面，默认显示公开主页，无刷新 fade 切换
- **日系治愈设计** — 温暖奶油米白底色 + 浅粉浅紫渐变，Apple 留白感 × Notion 卡片布局
- **猫系元素** — 浮动云朵、星星、猫爪、代码符号等 CSS 纯动画装饰
- **完全响应式** — 桌面 / 平板 / 手机三段适配，卡片网格自动调整列数
- **自然动画** — IntersectionObserver 滚动入场、头像 hover 3D 倾斜、心跳特效
- **零依赖框架** — 纯 HTML + CSS + JavaScript，Font Awesome 图标（CDN 加载）
- **可访问性** — 语义化 HTML、ARIA 标签、`prefers-reduced-motion` 适配

## 🚀 快速开始

### 部署到 GitHub Pages

1. Fork 或推送代码到 `<your-username>.github.io` 仓库
2. 进入仓库 Settings → Pages
3. Source 选择 `main` 分支，根目录 `/ (root)`
4. 等待部署完成，访问 `https://<your-username>.github.io`

### 本地预览

```bash
# 任意静态服务器均可
python3 -m http.server 8000
# 或
npx serve .
```

然后访问 `http://localhost:8000`。

## 📁 项目结构

```
.
├── index.html      # 主页面（页面 A：访客专属 + 页面 B：公开主页）
├── style.css       # 样式系统（颜色、布局、动画、响应式）
├── script.js       # 路由控制、滚动动画、交互效果
├── pics/
│   └── SH.JPG      # 头像
└── README.md
```

## 🎨 设计系统

### 颜色

| 用途 | 色值 |
|------|------|
| 主背景 | `#F8F0E8`（温暖奶油米白） |
| 浅粉 | `#F3DEE6` / `#FF9EBE` |
| 浅紫 | `#DDD6FE` / `#C8A2E0` |
| 浅灰 | `#E5E7EB` |
| 主文字 | `#2B2B2B` |
| 次文字 | `#6B7280` |

### 关键词

`日系` `治愈` `猫系` `AI` `程序员` `Digital Garden`

## 📄 页面说明

### 页面 A — 访客专属（`?from=4b68ab3847feda7d`）

面向特定渠道访客的温暖私人页面，包含：

- 大圆头像 + 欢迎语
- About Me 兴趣标签
- My Life 生活卡片（摄影、音乐、猫咪、旅行、咖啡）
- Little Notes 短文字卡片
- Connect 社交链接

### 页面 B — 公开个人主页（默认）

面向所有人的公开主页，包含：

- Hero 头像 + 身份标签 + 简介
- About 自我介绍
- Projects 项目卡片（AI / 笔记 / 开源 / 实验）
- Thoughts 随笔列表（分类标签：随笔 / 技术 / 生活）
- Skills 技能标签云
- Links 社交链接

## 🛠 技术栈

- HTML5（语义化标签、Open Graph）
- CSS3（Grid、Flexbox、自定义属性、动画、媒体查询、backdrop-filter）
- JavaScript（ES5+，URLSearchParams、IntersectionObserver）
- Font Awesome 6（社交图标）

## 📝 许可

MIT License

