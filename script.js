/**
 * kevi_nya - 个人数字花园
 * JavaScript：页面路由、动画控制、交互效果
 */

(function () {
  'use strict';

  // ==================== 常量 ====================
  // 专属页面的秘密参数 key
  const SECRET_KEY = '4b68ab3847feda7d';
  const PARAM_NAME = 'from';

  // DOM 元素引用
  const pageA = document.getElementById('page-a');
  const pageB = document.getElementById('page-b');

  // ==================== URL 参数检测 ====================

  /**
   * 获取当前 URL 中指定参数的值
   * @param {string} name - 参数名
   * @returns {string|null} 参数值或 null
   */
  function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  /**
   * 判断是否为访客专属页面
   * @returns {boolean}
   */
  function isVisitorPage() {
    return getUrlParam(PARAM_NAME) === SECRET_KEY;
  }

  // ==================== 页面切换 ====================

  /**
   * 显示指定页面，隐藏另一个页面
   * 包含 fade 过渡效果
   * @param {'a' | 'b'} pageId - 要显示的页面标识
   */
  function showPage(pageId) {
    const showEl = pageId === 'a' ? pageA : pageB;
    const hideEl = pageId === 'a' ? pageB : pageA;

    // 先移除隐藏类，但设置初始透明状态用于过渡
    showEl.classList.remove('hidden');
    hideEl.classList.add('hidden');

    // 强制回流后触发动画
    void showEl.offsetWidth;
    showEl.classList.add('fade-in');

    // 动画结束后清理类名
    showEl.addEventListener('animationend', function handler() {
      showEl.classList.remove('fade-in');
      showEl.removeEventListener('animationend', handler);
    });

    // 触发滚动动画重新检测
    initScrollAnimation();
  }

  /**
   * 初始化页面选择
   * 根据 URL 参数决定显示页面 A 还是 B
   */
  function initPageRouting() {
    if (isVisitorPage()) {
      showPage('a');
    }
    // 默认显示页面 B（已在 HTML 中设为可见，页面 A 默认 hidden）
  }

  // ==================== 滚动入场动画 ====================

  /**
   * 使用 IntersectionObserver 实现滚动时卡片依次上浮
   */
  function initScrollAnimation() {
    const animatedElements = document.querySelectorAll('.fade-in-up');

    // 如果浏览器不支持 IntersectionObserver，直接显示所有元素
    if (!('IntersectionObserver' in window)) {
      animatedElements.forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // 元素显示后取消观察，避免重复触发
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    animatedElements.forEach(function (el) {
      // 重置动画状态（页面切换时）
      el.classList.remove('visible');
      observer.observe(el);
    });
  }

  // ==================== 头像交互增强 ====================

  /**
   * 为头像添加鼠标跟随光效
   */
  function initAvatarEffect() {
    var avatars = document.querySelectorAll('.avatar');
    avatars.forEach(function (avatar) {
      avatar.addEventListener('mousemove', function (e) {
        var rect = avatar.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        var rotateX = (y / rect.height) * -8;
        var rotateY = (x / rect.width) * 8;
        avatar.style.transform =
          'scale(1.08) perspective(400px) rotateX(' +
          rotateX +
          'deg) rotateY(' +
          rotateY +
          'deg)';
      });

      avatar.addEventListener('mouseleave', function () {
        avatar.style.transform = '';
      });
    });
  }

  // ==================== 背景视差跟随（鼠标交互） ====================

  /**
   * 背景视差跟随系统
   * 鼠标移动时，不同层级元素产生不同强度的轻柔偏移（10-25px），
   * 使用 requestAnimationFrame 确保流畅，移动端优雅降级。
   *
   * 设计说明：
   * - .bg-image-parallax（包装层）接收 JS 视差偏移
   * - .bg-image-layer（内层）保留 CSS ken-burns 呼吸动画，互不冲突
   * - .bg-decorations 及其子元素各自有 CSS 漂浮动画，仅容器级视差
   */
  function initBackgroundParallax() {
    // 检测是否为移动设备（触摸屏 + 小屏幕）
    var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
                   ('ontouchstart' in window && window.innerWidth < 768);

    // 移动端：使用极弱强度
    var mobileMultiplier = isMobile ? 0.2 : 1.0;

    // 各层视差强度配置（单位：px，最终值会乘以移动端系数）
    var layers = [
      { selector: '.bg-image-parallax', intensity: 20 },  // 最深层：20px
      { selector: '.bg-decorations',    intensity: 12 },  // 中层：12px
    ];

    // 当前鼠标位置（归一化到 [-1, 1]）
    var targetX = 0;
    var targetY = 0;

    // 当前平滑位置（用于 lerp 插值）
    var currentX = 0;
    var currentY = 0;

    // 平滑因子（越小越慢越梦幻，0.04 提供丝滑的跟手感）
    var smoothingFactor = 0.04;

    // 缓存 DOM 引用
    var cachedLayers = [];

    /**
     * 初始化：缓存所有层的 DOM 引用
     */
    function cacheLayerRefs() {
      layers.forEach(function (layer) {
        var el = document.querySelector(layer.selector);
        if (el) {
          cachedLayers.push({ el: el, intensity: layer.intensity });
        }
      });
    }

    /**
     * 鼠标移动处理 — 计算目标位置（以视口中心为原点，归一化到 [-1, 1]）
     */
    function onMouseMove(e) {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    }

    /**
     * 触摸移动处理（移动端轻量跟随）
     */
    function onTouchMove(e) {
      if (!e.touches || e.touches.length === 0) return;
      targetX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
      targetY = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
    }

    /**
     * 动画循环 — 使用 requestAnimationFrame 平滑插值
     * Lerp 实现丝滑的"惯性"跟手效果
     */
    function animateParallax() {
      // Lerp 平滑插值：当前值逐渐靠近目标值
      currentX += (targetX - currentX) * smoothingFactor;
      currentY += (targetY - currentY) * smoothingFactor;

      // 应用偏移到各背景层
      for (var i = 0; i < cachedLayers.length; i++) {
        var layer = cachedLayers[i];
        var offsetX = currentX * layer.intensity * mobileMultiplier;
        var offsetY = currentY * layer.intensity * mobileMultiplier;
        layer.el.style.transform =
          'translate3d(' + offsetX + 'px, ' + offsetY + 'px, 0)';
      }

      requestAnimationFrame(animateParallax);
    }

    /**
     * 鼠标/触摸离开时，缓慢回中
     */
    function onMouseLeave() {
      targetX = 0;
      targetY = 0;
    }

    // --- 执行初始化 ---
    cacheLayerRefs();

    // 绑定事件（passive: true 优化滚动性能）
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    if (isMobile) {
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', onMouseLeave);
    }

    // 启动动画循环
    requestAnimationFrame(animateParallax);
  }

  // ==================== Canvas 粒子系统 ====================

  /**
   * Canvas 梦幻粒子背景
   * 细碎星星、缓慢上升微光、偶尔出现的猫爪/爱心
   * 与鼠标轻柔互动，营造漂浮在云上的治愈 AI 小房间氛围
   *
   * 配置说明（可通过修改 CONFIG 对象轻松调节）：
   * - particleCount: 桌面端粒子总数（默认 120）
   * - mobileCount:  移动端粒子总数（默认 40）
   * - mouseForce:   鼠标吸引力强度（默认 0.25，值越大越跟手）
   * - mouseRadius:  鼠标影响半径（默认 180px）
   * - 调整 starRatio/glowRatio/pawRatio/heartRatio 改变各类型比例
   */
  function initBackgroundParticles() {
    // --- 可配置参数（通过此对象轻松开关/调节） ---
    var CONFIG = {
      particleCount: 100,        // 桌面端粒子总数（精简数量，提升单粒质量）
      mobileCount: 35,           // 移动端粒子总数
      starRatio: 0.45,           // 星星粒子比例
      glowRatio: 0.30,           // 微光粒子比例（提高微光占比）
      pawRatio: 0.08,            // 猫爪粒子比例
      heartRatio: 0.07,          // 爱心粒子比例
      catEarRatio: 0.10,         // 猫耳轮廓粒子比例
      minSize: 1.2,              // 基础粒子最小半径(px) — 略增大
      maxSize: 4.5,              // 基础粒子最大半径(px) — 增大辉光尺寸
      pawHeartSize: 16,          // 猫爪/爱心显示字号(px)
      minOpacity: 0.12,          // 粒子最低透明度
      maxOpacity: 0.50,          // 粒子最高透明度（大幅提高微光感）
      mouseForce: 0.20,          // 鼠标吸引力（降低，让粒子更自然地漂浮）
      mouseRadius: 200,          // 鼠标影响半径(px) — 增大，更柔和
      floatBaseSpeed: 0.10,      // 基础漂浮速度（放慢，更梦幻）
      swayAmplitude: 0.5,        // 摇摆幅度（增大）
      pawHeartLifetime: 7000,    // 猫爪/爱心存活时间(ms)
      catEarLifetime: 10000,     // 猫耳轮廓存活时间(ms) — 更久停留
      glowRiseSpeed: 0.22,       // 微光上升速度（放慢）
    };

    // --- 检测环境 ---
    var canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    // prefers-reduced-motion：用户减少动画时直接跳过
    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    // 移动端检测
    var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
                   ('ontouchstart' in window && window.innerWidth < 768);

    var ctx = canvas.getContext('2d');
    var particles = [];
    var particleCount = isMobile ? CONFIG.mobileCount : CONFIG.particleCount;

    // 鼠标状态
    var mouseX = -9999;
    var mouseY = -9999;
    var mousePresent = false;

    // Canvas 尺寸
    var w, h;
    // 像素比（HiDPI 适配）
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    // --- 颜色调色板（严格匹配网站色系） ---
    var colors = [
      { r: 255, g: 158, b: 190 },  // 浅粉 accent-pink
      { r: 200, g: 162, b: 224 },  // 浅紫 accent-purple
      { r: 221, g: 214, b: 254 },  // 浅紫 light
      { r: 255, g: 220, b: 235 },  // 柔和粉
      { r: 243, g: 222, b: 230 },  // 浅粉 bg-pink-light
      { r: 255, g: 245, b: 240 },  // 暖白
      { r: 235, g: 210, b: 245 },  // 淡紫
    ];

    // --- 粒子类 ---
    /**
     * 创建一个粒子
     * @param {string} type - 'star' | 'glow' | 'paw' | 'heart'
     */
    function Particle(type) {
      this.type = type;
      this.reset(true); // 初始化时随机位置
    }

    /**
     * 重置粒子状态
     * @param {boolean} randomY - 是否随机 Y（初始化时 true，边界重生时根据类型决定）
     */
    Particle.prototype.reset = function (randomY) {
      var colorIdx = Math.floor(Math.random() * colors.length);
      var color = colors[colorIdx];

      this.x = Math.random() * w;
      this.y = randomY ? Math.random() * h : (this.type === 'glow' ? h + 20 : -20);
      this.color = color;
      this.baseSize = CONFIG.minSize + Math.random() * (CONFIG.maxSize - CONFIG.minSize);
      this.baseOpacity = CONFIG.minOpacity + Math.random() * (CONFIG.maxOpacity - CONFIG.minOpacity);
      this.twinklePhase = Math.random() * Math.PI * 2;  // 闪烁相位（星星用）
      this.swayPhase = Math.random() * Math.PI * 2;     // 摇摆相位
      this.swaySpeed = 0.3 + Math.random() * 0.7;       // 摇摆速度
      this.floatSpeed = CONFIG.floatBaseSpeed * (0.6 + Math.random() * 0.8);

      // 猫爪/爱心/猫耳特有
      if (this.type === 'paw' || this.type === 'heart') {
        this.birthTime = performance.now();
        this.lifetime = CONFIG.pawHeartLifetime * (0.5 + Math.random());
        this.opacity = 0; // 从淡入开始
        this.scale = 0.6 + Math.random() * 0.4;
      } else if (this.type === 'catEar') {
        this.birthTime = performance.now();
        this.lifetime = CONFIG.catEarLifetime * (0.5 + Math.random());
        this.opacity = 0;
        this.scale = 0.5 + Math.random() * 0.5;
      } else {
        this.opacity = this.baseOpacity;
        this.lifetime = Infinity;
      }
    };

    /**
     * 更新粒子位置与状态
     * @param {number} dt - 时间增量（归一化，约 0.016 @ 60fps）
     */
    Particle.prototype.update = function (dt) {
      var effectiveDt = Math.min(dt, 2.5); // 防止标签页切换后跳帧

      // 基础漂浮（微光粒子向上漂，其他轻微随机漂浮）
      if (this.type === 'glow') {
        this.y -= CONFIG.glowRiseSpeed * effectiveDt;
      } else {
        this.y -= this.floatSpeed * 0.3 * effectiveDt;
      }

      // 水平轻微摇摆
      this.x += Math.sin(performance.now() * 0.0005 * this.swaySpeed + this.swayPhase)
                * CONFIG.swayAmplitude * effectiveDt;

      // 鼠标互动：轻柔吸引
      if (mousePresent) {
        var dx = mouseX - this.x;
        var dy = mouseY - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.mouseRadius && dist > 0) {
          var force = (1 - dist / CONFIG.mouseRadius) * CONFIG.mouseForce;
          this.x += (dx / dist) * force * effectiveDt * 30;
          this.y += (dy / dist) * force * effectiveDt * 30;
        }
      }

      // 猫爪/爱心/猫耳：计算淡入淡出
      if (this.type === 'paw' || this.type === 'heart' || this.type === 'catEar') {
        var elapsed = performance.now() - this.birthTime;
        var progress = elapsed / this.lifetime;
        if (progress > 1) {
          this.reset(false);
          return;
        }
        // 前10%淡入，后30%淡出
        if (progress < 0.1) {
          this.opacity = this.baseOpacity * (progress / 0.1);
        } else if (progress > 0.7) {
          this.opacity = this.baseOpacity * ((1 - progress) / 0.3);
        } else {
          this.opacity = this.baseOpacity;
        }
      }

      // 边界检测：超出则重生
      var margin = 30;
      if (this.y < -margin || this.y > h + margin ||
          this.x < -margin || this.x > w + margin) {
        this.reset(this.type !== 'glow');
      }
    };

    /**
     * 绘制粒子
     */
    Particle.prototype.draw = function () {
      ctx.save();
      var currentOpacity = this.opacity;

      // 星星粒子：闪烁 + 四角星形
      if (this.type === 'star') {
        var twinkle = 0.5 + 0.5 * Math.sin(
          performance.now() * 0.002 + this.twinklePhase
        );
        currentOpacity = this.baseOpacity * (0.5 + twinkle * 0.5);

        ctx.globalAlpha = currentOpacity;
        ctx.fillStyle = rgbStr(this.color);

        var size = this.baseSize;
        var cx = this.x, cy = this.y;

        // 绘制发光光晕
        var glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 2.5);
        glowGrad.addColorStop(0, rgbaStr(this.color, currentOpacity * 0.7));
        glowGrad.addColorStop(1, rgbaStr(this.color, 0));
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 绘制四角星
        drawStar4(cx, cy, size, size * 0.4, rgbaStr(this.color, 1));
      }

      // 微光粒子：柔光圆点 + 光晕
      else if (this.type === 'glow') {
        ctx.globalAlpha = currentOpacity;
        var grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.baseSize * 3);
        grad.addColorStop(0, rgbaStr(this.color, 1));
        grad.addColorStop(0.3, rgbaStr(this.color, 0.5));
        grad.addColorStop(1, rgbaStr(this.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.baseSize * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 猫爪粒子：emoji 文字
      else if (this.type === 'paw') {
        ctx.globalAlpha = this.opacity;
        ctx.font = Math.round(CONFIG.pawHeartSize * this.scale * dpr) + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐾', this.x, this.y);
      }

      // 爱心粒子：文字渲染
      else if (this.type === 'heart') {
        ctx.globalAlpha = this.opacity;
        ctx.font = Math.round(CONFIG.pawHeartSize * this.scale * dpr) + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var symbol = Math.random() > 0.5 ? '♡' : '♥';
        ctx.fillStyle = rgbStr(this.color);
        ctx.fillText(symbol, this.x, this.y);
      }

      // 猫耳轮廓粒子：极简猫耳三角形
      else if (this.type === 'catEar') {
        ctx.globalAlpha = this.opacity * 0.7;
        drawCatEar(this.x, this.y, this.baseSize * 4, this.color);
      }

      ctx.restore();
    };

    // --- 工具函数 ---
    function rgbStr(c) {
      return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
    }
    function rgbaStr(c, a) {
      return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    }

    /**
     * 绘制四角星形
     */
    function drawStar4(cx, cy, outerR, innerR, color) {
      var spikes = 4;
      var step = Math.PI / spikes;
      var rot = Math.PI / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (var i = 0; i < spikes * 2; i++) {
        var r = i % 2 === 0 ? outerR : innerR;
        var angle = i * step - rot;
        var px = cx + Math.cos(angle) * r;
        var py = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    /**
     * 绘制猫耳轮廓（简单三角形 + 光晕）
     */
    function drawCatEar(cx, cy, size, color) {
      var halfW = size * 0.45;
      var h = size * 0.8;
      var alpha = 0.35;
      ctx.strokeStyle = rgbaStr(color, alpha);
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      // 左耳
      ctx.moveTo(cx - size * 0.3, cy + h * 0.1);
      ctx.lineTo(cx - halfW, cy - h);
      ctx.lineTo(cx - size * 0.05, cy + h * 0.05);
      // 右耳
      ctx.moveTo(cx + size * 0.3, cy + h * 0.1);
      ctx.lineTo(cx + halfW, cy - h);
      ctx.lineTo(cx + size * 0.05, cy + h * 0.05);
      ctx.stroke();

      // 猫耳光晕
      var glowGrad = ctx.createRadialGradient(cx, cy - h * 0.6, 0, cx, cy - h * 0.6, size * 1.5);
      glowGrad.addColorStop(0, rgbaStr(color, 0.15));
      glowGrad.addColorStop(1, rgbaStr(color, 0));
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy - h * 0.6, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- 初始化粒子池 ---
    function createParticles() {
      particles = [];
      var typeDist = [
        { type: 'star', ratio: CONFIG.starRatio },
        { type: 'glow', ratio: CONFIG.glowRatio },
        { type: 'paw', ratio: CONFIG.pawRatio },
        { type: 'heart', ratio: CONFIG.heartRatio },
        { type: 'catEar', ratio: CONFIG.catEarRatio },
      ];

      // 按比例分配
      var cursor = 0;
      for (var i = 0; i < typeDist.length; i++) {
        var count = Math.round(particleCount * typeDist[i].ratio);
        for (var j = 0; j < count && cursor < particleCount; j++) {
          particles.push(new Particle(typeDist[i].type));
          cursor++;
        }
      }
      // 填充剩余（四舍五入导致）
      while (cursor < particleCount) {
        particles.push(new Particle('star'));
        cursor++;
      }
    }

    // --- Canvas 尺寸适配 ---
    function resizeCanvas() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // 监听窗口 resize（带防抖）
    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeCanvas();
      }, 150);
    }
    window.addEventListener('resize', onResize);

    // --- 鼠标交互 ---
    function onMouseMove(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      mousePresent = true;
    }
    function onMouseLeave() {
      mousePresent = false;
    }
    function onTouchMove(e) {
      if (!e.touches || e.touches.length === 0) return;
      mouseX = e.touches[0].clientX;
      mouseY = e.touches[0].clientY;
      mousePresent = true;
    }
    function onTouchEnd() {
      mousePresent = false;
    }

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    if (isMobile) {
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', onTouchEnd);
    }

    // --- 主渲染循环 ---
    var lastTime = performance.now();

    function animate(now) {
      // 计算归一化时间增量
      var dt = (now - lastTime) / 16.667; // 约 1.0 @ 60fps
      lastTime = now;

      // 清空画布
      ctx.clearRect(0, 0, w, h);

      // 更新 + 绘制所有粒子
      for (var i = 0; i < particles.length; i++) {
        particles[i].update(dt);
        particles[i].draw();
      }

      requestAnimationFrame(animate);
    }

    // --- 启动 ---
    resizeCanvas();
    createParticles();
    requestAnimationFrame(animate);
  }
  function loadData() {
    // 添加时间戳参数避免浏览器/CDN 缓存旧版本的 data.json
    var cacheBuster = '?v=' + Date.now();
    return fetch('data.json' + cacheBuster)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('数据加载失败: HTTP ' + response.status);
        }
        return response.json();
      })
      .catch(function (error) {
        console.warn('⚠️ 无法加载 data.json，使用默认数据:', error.message);
        // 降级：返回默认数据
        return getDefaultData();
      });
  }

  /**
   * 默认数据（当 data.json 不可用时的降级方案）
   * 注意：little_notes 和 thoughts 保持为空数组，
   * 避免 data.json 更新后降级时仍显示旧内容。
   * @returns {Object}
   */
  function getDefaultData() {
    return {
      about_tags: [
        { emoji: '🤖', label: 'AI 爱好者' },
        { emoji: '🐱', label: '猫咪' },
        { emoji: '📷', label: '摄影' },
      ],
      life_cards: [
        { emoji: '📷', title: 'Photography', description: '用镜头捕捉生活中的温柔瞬间' },
        { emoji: '🐱', title: 'Cats', description: '猫咪是世界上最美好的存在' },
      ],
      little_notes: [],
      thoughts: [],
      skills: [
        { emoji: '🤖', name: 'AI' },
        { emoji: '🐍', name: 'Python' },
      ],
      links: [
        { platform: 'GitHub', url: 'https://github.com/Kevi-Nya', icon_class: 'fa-brands fa-github' },
        { platform: 'Bilibili', url: 'https://space.bilibili.com/456988162?spm_id_from=333.1007.0.0', icon_class: 'fa-brands fa-bilibili' },
        { platform: 'Email', url: 'mailto:1447954419@qq.com', icon_class: 'fa-solid fa-envelope' },
      ],
    };
  }

  /**
   * 渲染 About Me 兴趣标签
   * @param {Array} tags - 标签数组 [{emoji, label}, ...]
   */
  function renderAboutTags(tags) {
    var container = document.getElementById('about-tags-container');
    if (!container) return;

    var html = '';
    tags.forEach(function (tag) {
      html += '<span class="tag">' + tag.emoji + ' ' + tag.label + '</span>';
    });
    container.innerHTML = html;
  }

  /**
   * 渲染 My Life 生活卡片
   * @param {Array} cards - 卡片数组 [{emoji, title, description}, ...]
   */
  function renderLifeCards(cards) {
    var container = document.getElementById('life-cards-container');
    if (!container) return;

    var html = '';
    cards.forEach(function (card) {
      html +=
        '<div class="life-card">' +
        '<span class="life-emoji">' + card.emoji + '</span>' +
        '<h3>' + card.title + '</h3>' +
        '<p>' + card.description + '</p>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  // ==================== AI 标签自动生成 ====================

  /**
   * AI 标签生成器 — 基于语义关键词匹配的智能标签
   * 根据内容文本自动匹配 1~2 个最合适的标签，覆盖日常/猫咪/AI/思考等多领域。
   *
   * 设计目标：模拟 AI 语义理解，使用轻量关键词权重匹配，
   * 零外部依赖，运行在前端，性能友好。
   *
   * @param {string} content - 内容文本（笔记正文或想法标题+摘要）
   * @returns {string[]} 匹配到的标签数组（1~2 个，按匹配度降序）
   */
  function generateTags(content) {
    if (!content || typeof content !== 'string') return [];

    // 转为小写便于匹配（保留中文）
    var text = content.toLowerCase();

    // --- 标签关键词池（治愈猫系风格） ---
    var TAG_POOL = {
      '猫咪':   ['猫', '猫咪', '小猫', '喵', '猫猫', '毛孩子'],
      '日常':   ['日常', '今天', '昨天', '早上', '晚上', '下午', '每天'],
      'AI':     ['ai', '人工智能', '机器学习', '模型', '大语言', 'gpt', 'chatgpt'],
      '思考':   ['思考', '反思', '感悟', '启发', '意义', '哲学', '深度'],
      '摄影':   ['摄影', '拍照', '相机', '镜头', '照片', '拍摄', '构图'],
      '旅行':   ['旅行', '旅游', '出行', '远方', '路上', '风景', '目的地'],
      '音乐':   ['音乐', '歌', '耳机', '旋律', '节奏', '曲子', '播放'],
      '里程碑': ['第一个', '第一次', '终于', '完成', '达成', '实现', '里程碑', '突破'],
      '灵感':   ['灵感', '创意', '想法', '点子', '突然', '闪现'],
      '心情':   ['开心', '难过', '感动', '治愈', '温暖', '温柔', '幸福'],
      '学习':   ['学习', '读书', '看书', '知识', '课程', '教程'],
      '治愈':   ['治愈', '温暖', '温柔', '美好', '幸福', '小确幸', '阳光'],
      '代码':   ['代码', '编程', '程序', '重构', '开发', '项目', 'bug'],
      '记录':   ['记录', '日记', '手账', '笔记', '备忘', '记录下'],
      '美食':   ['好吃', '美食', '茶', '咖啡', '饮料', '料理', '厨房', '抹茶', '拿铁', '吃'],
      '夏天':   ['夏天', '夏日', '炎热', '空调', '西瓜', '冰'],
      '秋天':   ['秋天', '秋日', '落叶', '凉爽', '红叶'],
      '冬天':   ['冬天', '冬日', '雪', '火锅'],
      '春天':   ['春天', '春日', '花开', '樱花'],
      '探索':   ['探索', '发现', '未知', '冒险', '新事物'],
      '生活':   ['生活', '人生', '日子', '时光', '岁月'],
      '建站':   ['网站', '建站', '博客', '个人网站', '页面', '上线'],
    };

    // --- 计算每个标签的匹配得分 ---
    var scores = {};
    for (var tag in TAG_POOL) {
      if (!TAG_POOL.hasOwnProperty(tag)) continue;
      var keywords = TAG_POOL[tag];
      var score = 0;
      for (var i = 0; i < keywords.length; i++) {
        if (text.indexOf(keywords[i]) !== -1) {
          score += 1;
        }
      }
      if (score > 0) {
        scores[tag] = score;
      }
    }

    // --- 按得分降序排列，取前 2 个 ---
    var sorted = Object.keys(scores);
    sorted.sort(function (a, b) { return scores[b] - scores[a]; });

    return sorted.slice(0, 2);
  }

  /**
   * 为条目自动补全标签（仅当数据库未提供时使用 AI 生成）
   * 数据库中的 tag_1/tag_2 优先，空值时调用 generateTags()
   *
   * @param {Array} entries - 条目数组
   * @param {string} type - 'little' 或 'thoughts'
   */
  function enrichEntriesWithTags(entries, type) {
    if (!entries || entries.length === 0) return;

    entries.forEach(function (entry) {
      // Little Notes: 用 content 生成标签
      // Thoughts: 用 title + summary 生成标签
      var content =
        type === 'little'
          ? (entry.content || '')
          : ((entry.title || '') + ' ' + (entry.summary || ''));

      // 仅在前端打标签（不写回 data.json），且仅当 tag_1/tag_2 都为空时
      if (!entry.tag_1 && !entry.tag_2) {
        var generated = generateTags(content);
        // _tag_1/_tag_2 前缀下划线表示 AI 前端生成，区分于数据库写入的 tag_1/tag_2
        if (generated.length > 0) entry._tag_1 = generated[0];
        if (generated.length > 1) entry._tag_2 = generated[1];
      }
    });
  }

  /**
   * 渲染 Little Notes - 日历版
   * @param {Array} notes - 笔记数组 [{id, content, note_date, mood, tags}, ...]
   */
  function renderLittleNotes(notes) {
    var container = document.getElementById('little-notes-calendar');
    if (!container) return;
    container._entries = notes;
    renderCalendar(container, 'little');
  }

  /**
   * 使用数据渲染所有动态区域
   * @param {Object} data - 从 data.json 加载的数据
   */
  function renderDynamicContent(data) {
    // 自动补全 AI 标签（仅前端，不修改 data.json）
    if (data.little_notes) enrichEntriesWithTags(data.little_notes, 'little');
    if (data.thoughts) enrichEntriesWithTags(data.thoughts, 'thoughts');

    if (data.about_tags) renderAboutTags(data.about_tags);
    if (data.life_cards) renderLifeCards(data.life_cards);
    if (data.little_notes) renderLittleNotes(data.little_notes);
    if (data.thoughts) renderThoughts(data.thoughts);
    if (data.skills) renderSkills(data.skills);
    if (data.links) renderLinks(data.links);
  }

  /**
   * 渲染 Thoughts - 日历版
   * @param {Array} thoughts - [{id, title, summary, tags, tag_type, tag_label, thought_date}, ...]
   */
  function renderThoughts(thoughts) {
    var container = document.getElementById('thoughts-calendar');
    if (!container) return;
    container._entries = thoughts;
    renderCalendar(container, 'thoughts');
  }

  // ==================== 日历组件核心函数 ====================

  /**
   * 按日期字段分组条目
   * @param {Array} entries - 条目数组
   * @param {string} dateField - 日期字段名（如 'note_date' 或 'thought_date'）
   * @returns {Object} 以日期字符串为 key 的分组对象
   */
  function groupByDate(entries, dateField) {
    var map = {};
    entries.forEach(function (entry) {
      var date = entry[dateField];
      if (date) {
        if (!map[date]) map[date] = [];
        map[date].push(entry);
      }
    });
    return map;
  }

  /**
   * 获取指定月份的天数
   * @param {number} year - 年份
   * @param {number} month - 月份 (0-11)
   * @returns {number}
   */
  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  /**
   * 获取指定月份第一天是星期几
   * @param {number} year - 年份
   * @param {number} month - 月份 (0-11)
   * @returns {number} 0=周日, 1=周一, ... 6=周六
   */
  function firstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  }

  /**
   * 格式化日期为 YYYY-MM-DD 字符串
   * @param {number} year
   * @param {number} month (0-11)
   * @param {number} day
   * @returns {string}
   */
  function formatDate(year, month, day) {
    return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  /**
   * 渲染指定日期的详情面板内容（内部 HTML）
   * @param {string} dateStr - 日期字符串 YYYY-MM-DD
   * @param {Array} entries - 该日期的条目数组
   * @param {'little'|'thoughts'} type - 类型
   * @returns {string} HTML 字符串
   */
  function renderDetailContent(dateStr, entries, type) {
    var d = new Date(dateStr + 'T00:00:00');
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var dateDisplay = (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + weekdays[d.getDay()];

    var html = '<div class="note-detail-date">' + dateDisplay + '</div>';
    html += '<div class="note-detail-scroll">';

    if (!entries || entries.length === 0) {
      // 空日期温柔提示
      html += '<div class="note-detail-empty">';
      html += '<span class="note-detail-empty-icon">' + (type === 'little' ? '🌸' : '🌿') + '</span>';
      html += '<span class="note-detail-empty-text">' +
        (type === 'little' ? '这一天也很温柔呢 ✨' : '这一天还没有记录任何想法呢') +
        '</span>';
      html += '</div>';
    } else {
      entries.forEach(function (entry, index) {
        // 每条卡片带延迟动画实现依次淡入
        html += '<div class="note-detail-card" style="animation-delay:' + (index * 0.08) + 's">';

        if (type === 'little') {
          // Little Notes 卡片：内容 + 心情 + 标签
          if (entry.mood) {
            html += '<span class="note-detail-mood">' + entry.mood + '</span>';
          }
          html += '<p class="note-detail-content">' + entry.content + '</p>';

          // 标签行：优先数据库 tag_1/tag_2，其次 AI 生成的 _tag_1/_tag_2
          var tag1 = entry.tag_1 || entry._tag_1 || '';
          var tag2 = entry.tag_2 || entry._tag_2 || '';
          var isAiTag = !entry.tag_1 && !entry.tag_2; // 是否全部为 AI 生成

          if (tag1 || tag2) {
            html += '<div class="note-detail-tags">';
            if (tag1) {
              html += '<span class="note-detail-tag' +
                (isAiTag ? ' tag-ai-generated' : '') + '">' + tag1 + '</span>';
            }
            if (tag2) {
              html += '<span class="note-detail-tag' +
                (isAiTag ? ' tag-ai-generated' : '') + '">' + tag2 + '</span>';
            }
            html += '</div>';
          }

          // 兼容旧版 tags 数组（如果存在且 tag_1/tag_2 均无）
          if (!tag1 && !tag2 && entry.tags && entry.tags.length > 0) {
            html += '<div class="note-detail-tags">';
            entry.tags.forEach(function (tag) {
              html += '<span class="note-detail-tag">' + tag + '</span>';
            });
            html += '</div>';
          }
        } else {
          // Thoughts 卡片：标题 + 摘要 + 标签
          html += '<h3 class="note-detail-title">' + entry.title + '</h3>';
          html += '<p class="note-detail-summary">' + entry.summary + '</p>';

          var hasTags = entry.tag_label || entry.tag_1 || entry._tag_1 ||
                        entry.tag_2 || entry._tag_2 ||
                        (entry.tags && entry.tags.length > 0);

          if (hasTags) {
            html += '<div class="note-detail-tags">';

            // 主标签（tag_label + tag_type，来自数据库）
            if (entry.tag_label) {
              var tagClass = entry.tag_type ? 'tag-' + entry.tag_type : 'tag-default';
              html += '<span class="note-detail-tag ' + tagClass + '">' + entry.tag_label + '</span>';
            }

            // 优先数据库 tag_1/tag_2，其次 AI 生成
            var tt1 = entry.tag_1 || entry._tag_1 || '';
            var tt2 = entry.tag_2 || entry._tag_2 || '';
            var isAiTagT = !entry.tag_1 && !entry.tag_2;

            if (tt1) {
              html += '<span class="note-detail-tag' +
                (isAiTagT ? ' tag-ai-generated' : '') + '">' + tt1 + '</span>';
            }
            if (tt2) {
              html += '<span class="note-detail-tag' +
                (isAiTagT ? ' tag-ai-generated' : '') + '">' + tt2 + '</span>';
            }

            // 兼容旧版 tags 数组
            if (!tt1 && !tt2 && entry.tags && entry.tags.length > 0) {
              entry.tags.forEach(function (tag) {
                if (tag !== entry.tag_label) {
                  html += '<span class="note-detail-tag">' + tag + '</span>';
                }
              });
            }

            html += '</div>';
          }
        }

        // 关闭 .note-detail-card（little 和 thoughts 共用）
        html += '</div>';
      });
    }

    html += '</div>';
    return html;
  }

  /**
   * 渲染未选中日期时的初始占位提示
   * @param {'little'|'thoughts'} type
   * @returns {string} HTML 字符串
   */
  function renderPlaceholder(type) {
    return '<div class="note-detail-placeholder">' +
      '<span class="note-detail-placeholder-icon">' + (type === 'little' ? '📝' : '💭') + '</span>' +
      '<span class="note-detail-placeholder-text">' +
      (type === 'little' ? '点击左侧日期查看笔记' : '点击左侧日期查看想法') +
      '</span></div>';
  }

  /**
   * 绑定日历交互事件（日期点击 + 月份切换）
   * @param {HTMLElement} container - 日历容器 DOM 元素
   * @param {Object} dateMap - 按日期分组的条目对象
   * @param {'little'|'thoughts'} type
   */
  function bindCalendarEvents(container, dateMap, type) {
    // 日期格子点击事件
    var days = container.querySelectorAll('.calendar-day[data-date]');
    days.forEach(function (day) {
      day.addEventListener('click', function () {
        var dateStr = this.getAttribute('data-date');

        // 更新选中状态
        container.querySelectorAll('.calendar-day.selected').forEach(function (d) {
          d.classList.remove('selected');
        });
        this.classList.add('selected');
        container.setAttribute('data-selected', dateStr);

        // 更新右侧详情面板（带淡入过渡）
        var detailPanel = document.getElementById(container.id + '-detail');
        if (detailPanel) {
          var entries = dateMap[dateStr] || [];
          detailPanel.style.opacity = '0';
          detailPanel.style.transform = 'translateY(6px)';
          detailPanel.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
          setTimeout(function () {
            detailPanel.innerHTML = renderDetailContent(dateStr, entries, type);
            detailPanel.style.opacity = '1';
            detailPanel.style.transform = 'translateY(0)';
          }, 160);
        }
      });
    });

    // 月份切换按钮事件
    var navBtns = container.querySelectorAll('.calendar-nav');
    navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var year = parseInt(container.getAttribute('data-year'));
        var month = parseInt(container.getAttribute('data-month'));
        var dir = this.getAttribute('data-dir');

        if (dir === 'prev') {
          month--;
          if (month < 0) { month = 11; year--; }
        } else {
          month++;
          if (month > 11) { month = 0; year++; }
        }

        container.setAttribute('data-year', year);
        container.setAttribute('data-month', month);

        // 使用 CSS transition 实现日历平滑切换
        var calendarLeft = container.querySelector('.calendar-left');
        if (calendarLeft) {
          calendarLeft.style.opacity = '0';
          calendarLeft.style.transform = dir === 'prev' ? 'translateX(-12px)' : 'translateX(12px)';
          calendarLeft.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        }

        setTimeout(function () {
          // 清除选中日期，重新渲染日历
          container.setAttribute('data-selected', '');
          renderCalendar(container, type);
          if (calendarLeft) {
            calendarLeft.style.opacity = '1';
            calendarLeft.style.transform = 'translateX(0)';
          }
        }, 180);
      });
    });
  }

  /**
   * 渲染完整日历组件（左侧日历 + 右侧详情面板）
   * @param {HTMLElement} container - 日历容器 DOM 元素
   * @param {'little'|'thoughts'} type - 类型
   */
  function renderCalendar(container, type) {
    var entries = container._entries || [];
    var dateField = type === 'little' ? 'note_date' : 'thought_date';
    var dateMap = groupByDate(entries, dateField);

    var today = new Date();
    var todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

    // 从 DOM 属性读取或初始化状态
    var currentYear = parseInt(container.getAttribute('data-year')) || today.getFullYear();
    var currentMonth = parseInt(container.getAttribute('data-month')) || today.getMonth();
    var selectedDate = container.getAttribute('data-selected') || '';

    // 构建左侧日历 HTML
    var html = '<div class="calendar-left">';

    // 月份切换栏
    html += '<div class="calendar-month-header">';
    html += '<button class="calendar-nav calendar-nav-prev" data-dir="prev" aria-label="上个月">‹</button>';
    html += '<span class="calendar-month-label">' + currentYear + '年' + (currentMonth + 1) + '月</span>';
    html += '<button class="calendar-nav calendar-nav-next" data-dir="next" aria-label="下个月">›</button>';
    html += '</div>';

    // 星期标题行
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    html += '<div class="calendar-weekdays">';
    weekdays.forEach(function (w) {
      html += '<span>' + w + '</span>';
    });
    html += '</div>';

    // 日期网格 (7 列 x 最多 6 行)
    html += '<div class="calendar-grid">';

    var firstDay = firstDayOfMonth(currentYear, currentMonth);
    var totalDays = daysInMonth(currentYear, currentMonth);
    var prevMonthDays = daysInMonth(currentYear, currentMonth === 0 ? 11 : currentMonth - 1);

    // 填充上月末尾日期
    for (var i = firstDay - 1; i >= 0; i--) {
      var pDay = prevMonthDays - i;
      html += '<div class="calendar-day other-month">' + pDay + '</div>';
    }

    // 当月日期
    for (var d = 1; d <= totalDays; d++) {
      var dateStr = formatDate(currentYear, currentMonth, d);
      var classes = ['calendar-day'];
      var hasContent = dateMap[dateStr] && dateMap[dateStr].length > 0;

      if (dateStr === todayStr) classes.push('today');
      if (hasContent) classes.push('has-notes');
      if (dateStr === selectedDate) classes.push('selected');

      html += '<div class="' + classes.join(' ') + '" data-date="' + dateStr + '">' + d + '</div>';
    }

    // 填充下月开头日期（补满最后一行）
    var remaining = 7 - ((firstDay + totalDays) % 7);
    if (remaining < 7) {
      for (var nd = 1; nd <= remaining; nd++) {
        html += '<div class="calendar-day other-month">' + nd + '</div>';
      }
    }

    html += '</div></div>'; // 结束 calendar-left

    // 右侧详情面板
    html += '<div class="calendar-right"><div class="note-detail-panel" id="' + container.id + '-detail">';

    if (selectedDate && dateMap[selectedDate]) {
      html += renderDetailContent(selectedDate, dateMap[selectedDate], type);
    } else if (selectedDate && !dateMap[selectedDate]) {
      html += renderDetailContent(selectedDate, [], type);
    } else if (dateMap[todayStr] && dateMap[todayStr].length > 0) {
      // 默认：今天有内容则显示
      container.setAttribute('data-selected', todayStr);
      html += renderDetailContent(todayStr, dateMap[todayStr], type);
    } else {
      html += renderPlaceholder(type);
    }

    html += '</div></div>';

    container.innerHTML = html;

    // 持久化状态到 DOM 属性
    container.setAttribute('data-year', currentYear);
    container.setAttribute('data-month', currentMonth);

    // 绑定交互事件
    bindCalendarEvents(container, dateMap, type);
  }

  /**
   * 渲染 Skills 技能标签
   * @param {Array} skills - [{emoji, name}, ...]
   */
  function renderSkills(skills) {
    var container = document.getElementById('skills-container');
    if (!container) return;

    var html = '';
    skills.forEach(function (skill) {
      html += '<span class="skill-tag">' + skill.emoji + ' ' + skill.name + '</span>';
    });
    container.innerHTML = html;
  }

  /**
   * 渲染 Links 社交链接
   * @param {Array} links - [{platform, url, icon_class, qq_number?}, ...]
   */
  function renderLinks(links) {
    var container = document.getElementById('links-container');
    if (!container) return;

    var html = '';
    links.forEach(function (link) {
      html +=
        '<a href="' + link.url + '" class="connect-link" aria-label="' + link.platform + '"' +
        (link.qq_number ? ' data-qq="' + link.qq_number + '"' : '') + '>' +
        '<i class="' + link.icon_class + '"></i>' +
        '<span>' + link.platform + '</span>' +
        '</a>';
    });
    container.innerHTML = html;

    // 为 QQ 链接绑定点击复制事件
    var qqLink = container.querySelector('[data-qq]');
    if (qqLink) {
      qqLink.addEventListener('click', function (e) {
        e.preventDefault();
        var qqNumber = this.getAttribute('data-qq');
        copyToClipboard(qqNumber);
        showToast('QQ 号 ' + qqNumber + ' 已复制到剪贴板 ✨');
      });
    }
  }

  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   */
  function copyToClipboard(text) {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  /**
   * 降级复制方案（使用 textarea）
   * @param {string} text - 要复制的文本
   */
  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (e) {
      console.warn('复制失败:', e);
    }
    document.body.removeChild(textarea);
  }

  /**
   * 显示 Toast 提示
   * @param {string} message - 提示消息
   */
  function showToast(message) {
    // 移除已有 toast
    var existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    // 触发动画
    void toast.offsetWidth;
    toast.classList.add('show');

    // 2.5 秒后自动消失
    setTimeout(function () {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', function () {
        toast.remove();
      });
    }, 2500);
  }

  // ==================== 点击水波纹效果 ====================

  /**
   * 为卡片和按钮添加点击水波纹反馈
   */
  function initClickRipple() {
    var rippableSelectors = '.card, .life-card, .project-card, .note-card, .thought-item, ' +
      '.note-detail-card, .connect-link, .tag, .skill-tag, .calendar-day';
    var elements = document.querySelectorAll(rippableSelectors);

    elements.forEach(function (el) {
      el.addEventListener('click', function (e) {
        // 创建水波纹元素
        var ripple = document.createElement('span');
        ripple.className = 'ripple';

        var rect = el.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

        el.appendChild(ripple);

        // 动画结束后移除
        ripple.addEventListener('animationend', function () {
          ripple.remove();
        });
      });
    });
  }

  // ==================== 头像环绕粒子光环 ====================

  /**
   * 为头像区域添加 CSS 光环旋转动画
   * 通过 JavaScript 动态创建光环元素
   */
  function initAvatarRing() {
    var wrappers = document.querySelectorAll('.avatar-wrapper');
    wrappers.forEach(function (wrapper) {
      // 添加内光环
      var ringInner = document.createElement('div');
      ringInner.className = 'avatar-ring avatar-ring-inner';
      ringInner.setAttribute('aria-hidden', 'true');

      // 添加外光环
      var ringOuter = document.createElement('div');
      ringOuter.className = 'avatar-ring avatar-ring-outer';
      ringOuter.setAttribute('aria-hidden', 'true');

      wrapper.appendChild(ringInner);
      wrapper.appendChild(ringOuter);
    });
  }

  // ==================== 防抖工具 ====================

  /**
   * 防抖函数
   * @param {Function} fn - 要防抖的函数
   * @param {number} delay - 延迟毫秒数
   * @returns {Function}
   */
  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  // ==================== 初始化 ====================

  function init() {
    // 先加载数据并渲染，再初始化页面路由和动画
    loadData().then(function (data) {
      renderDynamicContent(data);

      initPageRouting();
      initScrollAnimation();
      initAvatarEffect();
      initAvatarRing();
      initClickRipple();
      initBackgroundParallax();
      initBackgroundParticles();
    });
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
