#!/usr/bin/env python3
"""
OG Image Generator — HTML 模板渲染方案
使用 Playwright 渲染网页模板 → 截图 → OG 卡片
输出: pics/og-image-{a,b}.jpg (2400×1260) + @2x.png (4800×2520)

用法:
  1. pip3 install playwright && playwright install chromium
  2. 修改 Page A 的 visitor URL 后运行
  3. python3 tools/generate-og-images.py
"""
import os, subprocess, base64, json

TEMPLATE = "tools/og-image-template.html"
OUT_DIR = "pics"

# ============ 配置 ============
PAGE_B_URL = "https://kevi-nya.github.io"
PAGE_A_URL = "https://kevi-nya.github.io/?from=YOUR_VISITOR_KEY"  # ← 替换为实际 visitor key

def generate(url, page_label, filename):
    """用 Playwright 渲染 HTML 模板并截图"""
    js_code = f"""
    const { chromium } = require('playwright');
    (async () => {{
        const browser = await chromium.launch();
        const page = await browser.newPage({{ viewport: {{ width: 2400, height: 1260 }}, deviceScaleFactor: 1 }});

        // 访问模板（使用 file:// 协议）
        await page.goto('file://{os.path.abspath(TEMPLATE)}', {{ waitUntil: 'networkidle' }});

        // 替换页面标签
        await page.evaluate((label) => {{
            document.getElementById('page-badge').textContent = label;
        }}, '{page_label}');

        // 替换 QR 码
        await page.evaluate((url) => {{
            const qrImg = document.getElementById('qr-img');
            qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=' + encodeURIComponent(url) + '&margin=4';
        }}, '{url}');

        // 等待 QR 码加载
        await page.waitForTimeout(1000);

        // 截图 @1x (2400×1260)
        await page.screenshot({{ path: '{OUT_DIR}/{filename}.jpg', type: 'jpeg', quality: 92 }});

        // 截图 @2x (4800×2520)
        await page.setViewportSize({{ width: 4800, height: 2520 }});
        await page.setDeviceScaleFactor(1);
        await page.evaluate(() => document.body.style.zoom = '2');
        await page.waitForTimeout(500);
        await page.screenshot({{ path: '{OUT_DIR}/{filename}@2x.png', type: 'png' }});

        await browser.close();
        console.log('done');
    }})();
    """
    subprocess.run(["node", "-e", js_code], check=True)
    print(f"  ✓ {filename}: JPG 2400×1260 + PNG 4800×2520")

if __name__ == '__main__':
    print("OG Image Generator (HTML Template + Playwright)\n")
    generate(PAGE_B_URL, "— 公 开 花 园 —", "og-image-b")
    generate(PAGE_A_URL, "— 秘 密 花 园 —", "og-image-a")
    print("\n✅ 完成")
