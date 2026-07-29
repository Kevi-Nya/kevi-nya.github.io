/**
 * kevi_nya - 个人数字花园
 * JavaScript：页面路由、动画控制、交互效果
 */

(function () {
  'use strict';

  // ==================== 常量 ====================
  // 专属页面密钥的 SHA-256 哈希值（不暴露明文密钥）
  // 实际使用请替换为真实密钥的哈希值
  var SECRET_HASH = '8c2be977af0aacf99f28cc4396e1236db29d38ea7f56a673b8eca380658589c3';
  var PARAM_NAME = 'from';

  // DOM 元素引用
  var pageA = document.getElementById('page-a');
  var pageB = document.getElementById('page-b');

  // ==================== 共享装饰层状态（供主粒子循环统一渲染） ====================
  // 萤火虫数据（由 midnight garden 填充，主循环绘制）
  var sharedFireflies = [];
  var sharedFirefliesActive = false;
  // 常驻爱心数据（由 heart burst 填充，主循环绘制）
  var sharedPermanentHearts = [];

  // — 时间数字粒子系统 —
  var timeParticles = [];       // 时间数字粒子
  var timeParticleElapsed = 0;  // 动画累计时间（秒）
  var timeParticleLastTs = 0;   // 上一帧时间戳
  var timeParticleOverlayCtx = null;  // 覆盖层 Canvas 2D context

  /**
   * 在主粒子循环每帧末尾统一绘制叠加装饰层
   * 包含：萤火虫粒子 + 心形碎裂常驻爱心
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   */
  function renderSharedDecorations(ctx, canvas) {
    // --- 萤火虫绘制 ---
    if (sharedFirefliesActive && sharedFireflies.length > 0) {
      var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      var isReducedMotion = motionQuery.matches;

      for (var i = 0; i < sharedFireflies.length; i++) {
        var f = sharedFireflies[i];
        // 不规则游走
        f.vx += (Math.random() - 0.5) * 0.02;
        f.vy += (Math.random() - 0.5) * 0.02;
        f.vx *= 0.995;
        f.vy *= 0.995;
        f.x += f.vx;
        f.y += f.vy;

        if (f.x < 0 || f.x > canvas.width) f.vx *= -1;
        if (f.y < 0 || f.y > canvas.height) f.vy *= -1;

        // 呼吸明灭
        var alpha = isReducedMotion ? 0.5 :
          (0.3 + 0.7 * (Math.sin(Date.now() * f.twinkleSpeed + f.phase) * 0.5 + 0.5));

        // 辉光
        ctx.beginPath();
        ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 232, 160, ' + (alpha * 0.3) + ')';
        ctx.fill();

        // 核心
        ctx.beginPath();
        ctx.arc(f.x, f.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220, 250, 180, ' + (alpha * 0.9) + ')';
        ctx.fill();
      }
    }

    // --- 常驻爱心绘制 ---
    if (sharedPermanentHearts.length > 0) {
      ctx.save();
      for (var j = 0; j < sharedPermanentHearts.length; j++) {
        var h = sharedPermanentHearts[j];
        h.x += h.vx;
        h.y += h.vy;
        h.vx *= 0.998;
        h.vy *= 0.998;
        h.rotation += h.rotSpeed * 0.016;

        if (h.x < 20 || h.x > canvas.width - 20) h.vx *= -1;
        if (h.y < 20 || h.y > canvas.height - 20) h.vy *= -1;

        ctx.globalAlpha = h.alpha;
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(h.rotation);
        ctx.font = h.size + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💛', 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // ==================== 安全哈希工具 ====================

  /**
   * 使用 SubtleCrypto 计算 SHA-256 哈希（异步）
   * @param {string} message - 待哈希的字符串
   * @returns {Promise<string>} 十六进制哈希字符串
   */
  function sha256(message) {
    if (!window.crypto || !window.crypto.subtle) {
      // 降级：不支持 SubtleCrypto 的环境回退到简单比较
      return Promise.resolve(null);
    }
    var encoder = new TextEncoder();
    var data = encoder.encode(message);
    return window.crypto.subtle.digest('SHA-256', data).then(function (hashBuffer) {
      var hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  // ==================== URL 参数检测 ====================

  /**
   * 获取当前 URL 中指定参数的值
   * @param {string} name - 参数名
   * @returns {string|null} 参数值或 null
   */
  function getUrlParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  /**
   * 判断是否为访客专属页面（异步，使用哈希比较）
   * @returns {Promise<boolean>}
   */
  function isVisitorPage() {
    var paramValue = getUrlParam(PARAM_NAME);
    if (!paramValue) return Promise.resolve(false);
    return sha256(paramValue).then(function (hash) {
      if (hash === null) {
        // SubtleCrypto 不可用时的降级安全策略：仅检查长度
        return paramValue.length >= 8;
      }
      return hash === SECRET_HASH;
    });
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

    // 防御性日历重渲染：初始化阶段 renderDynamicContent 在 Page A 处于 display:none
    // 时渲染日历，部分浏览器在 display:none 容器内对 innerHTML 赋值存在不确定性。
    // 在页面变为可见后强制刷新日历，确保内容始终正确。
    if (pageId === 'a') {
      var lnContainer = document.getElementById('little-notes-calendar');
      if (lnContainer && lnContainer._entries) {
        renderCalendar(lnContainer, 'little');
      }
    } else {
      var thContainer = document.getElementById('thoughts-calendar');
      if (thContainer && thContainer._entries) {
        renderCalendar(thContainer, 'thoughts');
      }
    }

    // 强制显示目标页面的所有动画元素（防止 initScrollAnimation 时序竞争导致内容不可见）
    showEl.querySelectorAll('.fade-in-up').forEach(function (el) {
      el.classList.add('visible');
    });

    // 强制回流后触发动画
    void showEl.offsetWidth;
    showEl.classList.add('fade-in');

    // 动画结束后清理类名
    showEl.addEventListener('animationend', function handler() {
      showEl.classList.remove('fade-in');
      showEl.removeEventListener('animationend', handler);
    });

    // 动效编排：场景级过渡 — 播放柔风音效 + 延迟触发容器级 stagger
    Choreographer.sceneTransition();

    // BGM 页面切换：自动 crossfade 到对应页面的环境音乐
    switchBgmForPage(pageId);
  }

  /**
   * 初始化页面选择（异步）
   * 根据 URL 参数决定显示页面 A 还是 B
   */
  function initPageRouting() {
    isVisitorPage().then(function (isVisitor) {
      if (isVisitor) {
        showPage('a');
      }
      // 默认显示页面 B（已在 HTML 中设为可见，页面 A 默认 hidden）
    });
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
    var parallaxRafId = requestAnimationFrame(animateParallax);

    // 页面不可见时暂停
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(parallaxRafId);
      } else {
        parallaxRafId = requestAnimationFrame(animateParallax);
      }
    });
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
      particleCount: 40,         // 桌面端粒子总数（精简，氛围而非内容）
      mobileCount: 20,           // 移动端粒子总数
      starRatio: 0.45,           // 星星粒子比例
      glowRatio: 0.30,           // 微光粒子比例
      pawRatio: 0.10,            // 猫爪粒子比例
      heartRatio: 0.07,          // 爱心粒子比例
      catEarRatio: 0.08,         // 猫耳轮廓粒子比例
      minSize: 1.2,              // 基础粒子最小半径(px)
      maxSize: 4.5,              // 基础粒子最大半径(px)
      pawHeartSize: 14,          // 猫爪/爱心显示字号(px)
      minOpacity: 0.08,          // 粒子最低透明度（降低，更柔和）
      maxOpacity: 0.35,          // 粒子最高透明度（降低，不抢眼）
      mouseForce: 0.20,          // 鼠标吸引力
      mouseRadius: 200,          // 鼠标影响半径(px)
      floatBaseSpeed: 0.10,      // 基础漂浮速度
      swayAmplitude: 0.5,        // 摇摆幅度
      pawHeartLifetime: 7000,    // 猫爪/爱心存活时间(ms)
      catEarLifetime: 10000,     // 猫耳轮廓存活时间(ms)
      glowRiseSpeed: 0.22,       // 微光上升速度
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
        // 同步时间粒子覆盖层尺寸
        var overlayCanvas = document.getElementById('time-particle-overlay');
        if (overlayCanvas) {
          overlayCanvas.width = window.innerWidth;
          overlayCanvas.height = window.innerHeight;
        }
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

      // 绘制共享装饰层（萤火虫 + 常驻爱心）
      renderSharedDecorations(ctx, canvas);

      // 绘制时间粒子覆盖层
      renderTimeParticles();

      requestAnimationFrame(animate);
    }

    // --- 启动 ---
    resizeCanvas();
    createParticles();
    var rafId = requestAnimationFrame(animate);

    // 页面不可见时暂停 rAF，节省电池
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        lastTime = performance.now(); // 重置时间基准，防止跳帧
        rafId = requestAnimationFrame(animate);
      }
    });
  }
  function loadData() {
    // 使用静态版本号替代 Date.now()，允许浏览器缓存
    var cacheBuster = '?v=2.1';
    return fetch('data.json' + cacheBuster)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('数据加载失败: HTTP ' + response.status);
        }
        return response.json();
      })
      .catch(function (error) {
        console.warn('⚠️ 无法加载 data.json，使用默认数据:', error.message);
        // 用户可见的错误提示
        showToast('数据加载失败，正在显示缓存数据 ⚠️', 5000);
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
        { platform: 'GitHub', url: 'https://github.com/Kevi-Nya' },
        { platform: 'Bilibili', url: 'https://space.bilibili.com/456988162?spm_id_from=333.1007.0.0' },
        { platform: 'Email', url: 'mailto:1447954419@qq.com' },
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
      html += '<span class="tag">' + escapeHtml(tag.emoji) + ' ' + escapeHtml(tag.label) + '</span>';
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
        '<span class="life-emoji">' + escapeHtml(card.emoji) + '</span>' +
        '<h3>' + escapeHtml(card.title) + '</h3>' +
        '<p>' + escapeHtml(card.description) + '</p>' +
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
    try { if (data.little_notes) enrichEntriesWithTags(data.little_notes, 'little'); } catch (e) { console.warn('[花园] 标签补全失败 (little_notes):', e); }
    try { if (data.thoughts) enrichEntriesWithTags(data.thoughts, 'thoughts'); } catch (e) { console.warn('[花园] 标签补全失败 (thoughts):', e); }

    try { if (data.about_tags) renderAboutTags(data.about_tags); } catch (e) { console.warn('[花园] 渲染失败 (about_tags):', e); }
    try { if (data.life_cards) renderLifeCards(data.life_cards); } catch (e) { console.warn('[花园] 渲染失败 (life_cards):', e); }
    try { if (data.little_notes) renderLittleNotes(data.little_notes); } catch (e) { console.warn('[花园] 渲染失败 (little_notes):', e); }
    try { if (data.thoughts) renderThoughts(data.thoughts); } catch (e) { console.warn('[花园] 渲染失败 (thoughts):', e); }
    try { if (data.skills) renderSkills(data.skills); } catch (e) { console.warn('[花园] 渲染失败 (skills):', e); }
    try { if (data.links) renderLinks(data.links); } catch (e) { console.warn('[花园] 渲染失败 (links):', e); }
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
            html += '<span class="note-detail-mood">' + escapeHtml(entry.mood) + '</span>';
          }
          html += '<p class="note-detail-content">' + escapeHtml(entry.content) + '</p>';

          // 标签行：优先数据库 tag_1/tag_2，其次 AI 生成的 _tag_1/_tag_2
          var tag1 = entry.tag_1 || entry._tag_1 || '';
          var tag2 = entry.tag_2 || entry._tag_2 || '';
          var isAiTag = !entry.tag_1 && !entry.tag_2; // 是否全部为 AI 生成

          if (tag1 || tag2) {
            html += '<div class="note-detail-tags">';
            if (tag1) {
              html += '<span class="note-detail-tag' +
                (isAiTag ? ' tag-ai-generated' : '') + '">' + escapeHtml(tag1) + '</span>';
            }
            if (tag2) {
              html += '<span class="note-detail-tag' +
                (isAiTag ? ' tag-ai-generated' : '') + '">' + escapeHtml(tag2) + '</span>';
            }
            html += '</div>';
          }

          // 兼容旧版 tags 数组（如果存在且 tag_1/tag_2 均无）
          if (!tag1 && !tag2 && entry.tags && entry.tags.length > 0) {
            html += '<div class="note-detail-tags">';
            entry.tags.forEach(function (tag) {
              html += '<span class="note-detail-tag">' + escapeHtml(tag) + '</span>';
            });
            html += '</div>';
          }
        } else {
          // Thoughts 卡片：标题 + 摘要 + 标签
          html += '<h3 class="note-detail-title">' + escapeHtml(entry.title) + '</h3>';
          html += '<p class="note-detail-summary">' + escapeHtml(entry.summary) + '</p>';

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
   * 使用事件委托避免多次渲染时监听器累积泄漏
   * @param {HTMLElement} container - 日历容器 DOM 元素
   * @param {Object} dateMap - 按日期分组的条目对象
   * @param {'little'|'thoughts'} type
   */
  function bindCalendarEvents(container, dateMap, type) {
    // 移除旧的委托监听器（避免重复绑定累积）
    var oldHandler = container._calendarClickHandler;
    if (oldHandler) {
      container.removeEventListener('click', oldHandler);
    }

    // 事件委托：统一在容器上监听所有 click 事件
    var clickHandler = function (e) {
      var target = e.target;

      // 处理日期格子点击
      var dayBtn = target.closest('.calendar-day[data-date]');
      if (dayBtn) {
        var dateStr = dayBtn.getAttribute('data-date');

        // 播放猫叫 toggle 音效（猫系灵魂专属）
        SoundEngine.playToggle();

        // 更新选中状态
        container.querySelectorAll('.calendar-day.selected').forEach(function (d) {
          d.classList.remove('selected');
        });
        dayBtn.classList.add('selected');
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
            // 内容展开时播放"叮咚"音效
            SoundEngine.playOpen();
          }, 160);
        }
        return;
      }

      // 处理月份切换按钮
      var navBtn = target.closest('.calendar-nav');
      if (navBtn) {
        // 播放月份切换"唰"声
        SoundEngine.playSwitch();

        var year = parseInt(container.getAttribute('data-year'));
        var month = parseInt(container.getAttribute('data-month'));
        var dir = navBtn.getAttribute('data-dir');

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
      }
    };

    // 存储 handler 引用以便后续移除
    container._calendarClickHandler = clickHandler;
    container.addEventListener('click', clickHandler);

    // 键盘导航：方向键移动日期，Enter 确认选择
    var oldKeyHandler = container._calendarKeyHandler;
    if (oldKeyHandler) {
      container.removeEventListener('keydown', oldKeyHandler);
    }

    var keyHandler = function (e) {
      // 仅处理方向键和 Enter
      var keyHandled = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].indexOf(e.key) !== -1;
      if (!keyHandled) return;

      var calendarGrid = container.querySelector('.calendar-grid');
      if (!calendarGrid) return;

      var allDays = calendarGrid.querySelectorAll('.calendar-day[data-date]');
      var currentSelected = calendarGrid.querySelector('.calendar-day.selected');
      var currentIndex = Array.from(allDays).indexOf(currentSelected);

      var newIndex = currentIndex;
      var colsPerRow = 7; // 标准日历 7 列

      switch (e.key) {
        case 'ArrowRight':
          newIndex = Math.min(currentIndex + 1, allDays.length - 1);
          break;
        case 'ArrowLeft':
          newIndex = Math.max(currentIndex - 1, 0);
          break;
        case 'ArrowDown':
          newIndex = Math.min(currentIndex + colsPerRow, allDays.length - 1);
          break;
        case 'ArrowUp':
          newIndex = Math.max(currentIndex - colsPerRow, 0);
          break;
        case 'Enter':
          // 模拟点击当前选中日期
          if (currentSelected) {
            currentSelected.click();
          }
          e.preventDefault();
          return;
        default:
          return;
      }

      e.preventDefault();

      // 切换焦点和选中状态
      var newDay = allDays[newIndex];
      if (newDay) {
        calendarGrid.querySelectorAll('.calendar-day.selected').forEach(function (d) {
          d.classList.remove('selected');
        });
        newDay.classList.add('selected');
        newDay.focus();

        // 更新详情面板
        var dateStr = newDay.getAttribute('data-date');
        container.setAttribute('data-selected', dateStr);
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
            // 键盘导航展开内容时播放音效
            SoundEngine.playOpen();
          }, 160);
        }
      }
    };

    container._calendarKeyHandler = keyHandler;
    container.addEventListener('keydown', keyHandler);

    // 为日历容器设置 role="grid" 以辅助屏幕阅读器
    container.setAttribute('role', 'grid');
    container.setAttribute('aria-label', type === 'little' ? '笔记日历' : '想法日历');
  }

  /**
   * 渲染完整日历组件（左侧日历 + 右侧详情面板）
   * @param {HTMLElement} container - 日历容器 DOM 元素
   * @param {'little'|'thoughts'} type - 类型
   */

  /**
   * 检查指定日期是否有留言瓶数据
   * @param {string} dateStr - 'YYYY-MM-DD' 格式
   * @returns {boolean}
   */
  function hasBottleMessages(dateStr) {
    try {
      var bottles = JSON.parse(localStorage.getItem('kevi_message_bottles') || '[]');
      return bottles.some(function (b) { return b.date === dateStr; });
    } catch (e) { return false; }
  }

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
    html += '<button class="calendar-nav calendar-nav-prev" data-dir="prev" aria-label="上一个月">‹</button>';
    html += '<span class="calendar-month-label" aria-live="polite">' + currentYear + '年' + (currentMonth + 1) + '月</span>';
    html += '<button class="calendar-nav calendar-nav-next" data-dir="next" aria-label="下一个月">›</button>';
    html += '</div>';

    // 星期标题行 (role="row")
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    html += '<div class="calendar-weekdays" role="row">';
    weekdays.forEach(function (w) {
      html += '<span>' + w + '</span>';
    });
    html += '</div>';

    // 日期网格 (7 列 x 最多 6 行) — role="grid" 语义
    html += '<div class="calendar-grid" role="grid">';

    var firstDay = firstDayOfMonth(currentYear, currentMonth);
    var totalDays = daysInMonth(currentYear, currentMonth);
    var prevMonthDays = daysInMonth(currentYear, currentMonth === 0 ? 11 : currentMonth - 1);

    // 填充上月末尾日期
    for (var i = firstDay - 1; i >= 0; i--) {
      var pDay = prevMonthDays - i;
      html += '<div class="calendar-day other-month" aria-hidden="true">' + pDay + '</div>';
    }

    // 当月日期 (使用 button 确保可访问性)
    for (var d = 1; d <= totalDays; d++) {
      var dateStr = formatDate(currentYear, currentMonth, d);
      var classes = ['calendar-day'];
      var hasContent = dateMap[dateStr] && dateMap[dateStr].length > 0;
      var hasBottle = hasBottleMessages(dateStr);

      if (dateStr === todayStr) classes.push('today');
      if (hasContent) classes.push('has-notes');
      if (hasBottle) classes.push('has-bottle');
      if (dateStr === selectedDate) classes.push('selected');

      var ariaLabel = (currentMonth + 1) + '月' + d + '日';
      if (dateStr === todayStr) ariaLabel += '，今天';
      if (hasContent) ariaLabel += '，有' + dateMap[dateStr].length + '条' + (type === 'little' ? '笔记' : '想法');
      if (hasBottle) ariaLabel += '，有留言瓶';

      html += '<button type="button" class="' + classes.join(' ') + '" data-date="' + dateStr + '"' +
        ' role="gridcell" tabindex="-1"' +
        ' aria-label="' + ariaLabel + '"' +
        (dateStr === selectedDate ? ' aria-selected="true"' : '') +
        (dateStr === todayStr ? ' aria-current="date"' : '') +
        '>' + d + '</button>';
    }

    // 填充下月开头日期（补满最后一行）
    var remaining = 7 - ((firstDay + totalDays) % 7);
    if (remaining < 7) {
      for (var nd = 1; nd <= remaining; nd++) {
        html += '<div class="calendar-day other-month" aria-hidden="true">' + nd + '</div>';
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
      html += '<span class="skill-tag">' + escapeHtml(skill.emoji) + ' ' + escapeHtml(skill.name) + '</span>';
    });
    container.innerHTML = html;
  }

  /**
   * 渲染 Links 社交链接
   * @param {Array} links - [{platform, url, ...}]
   */
  function renderLinks(links) {
    var container = document.getElementById('links-container');
    if (!container) return;

    // 平台 → 内联 SVG 图标映射
    var PLATFORM_ICONS = {
      'GitHub': '<svg class="connect-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
      'Bilibili': '<svg class="connect-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 01-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 01.16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z"/></svg>',
      'Email': '<svg class="connect-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
      'X': '<svg class="connect-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
      'QQ': '<svg class="connect-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="7" r="4.5"/><ellipse cx="8.5" cy="14" rx="2.5" ry="3.5"/><ellipse cx="15.5" cy="14" rx="2.5" ry="3.5"/><path d="M8.5 17.5c0 1.5 1.5 2.5 3.5 2.5s3.5-1 3.5-2.5"/></svg>',
    };

    var html = '';
    links.forEach(function (link) {
      var iconSvg = PLATFORM_ICONS[link.platform] || '';
      var isExternal = !link.qq_number; // QQ 链接为复制交互，非外部跳转
      html +=
        '<a href="' + escapeHtml(link.url) + '" class="connect-link" aria-label="' + escapeHtml(link.platform) + '"' +
        (isExternal ? ' target="_blank" rel="noopener noreferrer"' : '') +
        (link.qq_number ? ' data-qq="' + escapeHtml(link.qq_number) + '"' : '') + '>' +
        iconSvg +
        '<span>' + escapeHtml(link.platform) + '</span>' +
        '</a>';
    });
    container.innerHTML = html;
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
  function showToast(message, duration) {
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

    // 指定时间后自动消失（默认 2.5 秒）
    setTimeout(function () {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', function () {
        toast.remove();
      });
    }, duration || 2500);
  }

  /**
   * 彩蛋专用 Toast — 使用 .egg-toast 毛玻璃霞鹜文楷样式
   * @param {string} message - 提示文字
   * @param {number} [duration=3000] - 显示时长(ms)
   */
  function showEggToast(message, duration) {
    var existing = document.querySelector('.egg-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'egg-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('visible');
    });
    if (duration) {
      setTimeout(function () {
        toast.classList.remove('visible');
        setTimeout(function () { toast.remove(); }, 500);
      }, duration);
    }
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
        // 播放水滴点击音效
        SoundEngine.playClick();

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

  // ==================== 微交互音效 — Hover 钩子 ====================

  /**
   * 为可交互元素绑定 hover 音效
   * 使用事件委托 +mouseenter 冒泡，配合 SoundEngine 内部节流
   * 覆盖：卡片、生活卡片、项目卡片、连接链接、标签、技能标签、日历日期
   */
  function initSoundHooks() {
    var hoverSelectors = '.card, .life-card, .project-card, .connect-link, ' +
      '.tag, .skill-tag, .calendar-day[data-date], .calendar-nav, ' +
      '.note-detail-card, .avatar';

    document.addEventListener('mouseover', function (e) {
      var target = e.target.closest(hoverSelectors);
      if (target) {
        SoundEngine.playHover();
      }
    });
  }

  // ==================== 静音切换按钮 ====================

  /**
   * 初始化静音/取消静音切换按钮
   * 按钮固定在右下角，使用内联 SVG 图标
   * 首次用户点击任意位置时自动初始化 AudioContext（遵守自动播放策略）
   * 静音状态通过 .active class 控制（匹配前端工程师的 CSS 约定）
   */
  function initSoundToggle() {
    var toggle = document.getElementById('sound-toggle');
    if (!toggle) return;

    // 同步初始状态（从 localStorage 读取的偏好）
    updateSoundToggleState(toggle);

    // 点击切换静音
    toggle.addEventListener('click', function () {
      // 首次点击时初始化 AudioContext（遵守浏览器自动播放策略）
      SoundEngine.init();

      var newMuted = !SoundEngine.isMuted();
      SoundEngine.setMuted(newMuted);
      updateSoundToggleState(toggle);

      // 取消静音时播放反馈音效，让用户确认音效已开启
      if (!newMuted) {
        SoundEngine.playClick();
      }

      // 隐藏音效提示气泡
      hideSoundHint();
    });
  }

  /**
   * 更新静音按钮的视觉状态和 aria 属性
   * @param {HTMLElement} toggle - 按钮元素
   */
  function updateSoundToggleState(toggle) {
    var isMuted = SoundEngine.isMuted();
    toggle.setAttribute('aria-pressed', String(isMuted));
    toggle.setAttribute('aria-label', isMuted ? '开启音效' : '关闭音效');
    toggle.title = isMuted ? '开启音效' : '关闭音效';

    // 通过 .active class 控制图标切换（匹配 CSS 约定）
    if (isMuted) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  }

  /**
   * 音效首次使用提示气泡
   * 页面加载完成后延迟 1.5s 显示，4s 后自动淡出
   * 仅在用户未主动操作音效时显示一次（基于 sessionStorage）
   */
  function showSoundHint() {
    var HINT_KEY = 'kevi_sound_hint_shown';
    try {
      if (window.sessionStorage.getItem(HINT_KEY) === '1') return;
      window.sessionStorage.setItem(HINT_KEY, '1');
    } catch (e) { return; }

    var hint = document.getElementById('sound-hint');
    if (!hint) return;

    setTimeout(function () {
      hint.classList.add('visible');
      setTimeout(function () {
        hint.classList.add('fading');
      }, 4000);
    }, 1500);
  }

  function hideSoundHint() {
    var hint = document.getElementById('sound-hint');
    if (hint) {
      hint.classList.add('fading');
    }
  }

  // ==================== BGM 播放控制按钮 ====================

  /**
   * 初始化 BGM 播放/暂停按钮
   * 位于 SFX 按钮旁，三态图标：播放中 / 已开启 / 静音中
   */
  function initBgmToggle() {
    var toggle = document.getElementById('bgm-toggle');
    if (!toggle) return;

    updateBgmToggleState(toggle);

    toggle.addEventListener('click', function () {
      SoundEngine.init(); // 确保 AudioContext 存在
      BgmEngine.init();

      var newMuted = !BgmEngine.isMuted();
      BgmEngine.setMuted(newMuted);

      if (!newMuted) {
        // 开启了 BGM，开始播放当前页面的音乐
        var page = (pageA && !pageA.classList.contains('hidden')) ? 'a' : 'b';
        BgmEngine.play(page);
      }

      updateBgmToggleState(toggle);
    });
  }

  /**
   * 更新 BGM 按钮的视觉状态（三态图标）
   */
  function updateBgmToggleState(toggle) {
    var bgmMuted = BgmEngine.isMuted();
    var isPlaying = BgmEngine.isPlaying();

    toggle.setAttribute('aria-pressed', String(!bgmMuted));

    if (isPlaying) {
      toggle.setAttribute('aria-label', 'BGM 播放中 — 点击关闭');
      toggle.title = 'BGM 播放中 — 点击关闭';
    } else if (!bgmMuted) {
      toggle.setAttribute('aria-label', 'BGM 已开启 — 点击关闭');
      toggle.title = 'BGM 已开启 — 点击关闭';
    } else {
      toggle.setAttribute('aria-label', '开启 BGM 背景音乐');
      toggle.title = '开启 BGM 背景音乐';
    }

    // 三态 class 控制
    toggle.classList.remove('playing', 'muted');
    if (isPlaying) {
      toggle.classList.add('playing');
    } else if (bgmMuted) {
      toggle.classList.add('muted');
    }
  }

  // ==================== BGM 页面切换联动 ====================

  /**
   * 在页面切换时自动切换 BGM
   * @param {string} page - 'a' | 'b'
   */
  function switchBgmForPage(page) {
    BgmEngine.init();
    if (!BgmEngine.isMuted() && BgmEngine.isStarted()) {
      BgmEngine.play(page);
    }
    // 更新 BGM 按钮状态
    var toggle = document.getElementById('bgm-toggle');
    if (toggle) {
      updateBgmToggleState(toggle);
    }
  }

  // ==================== XSS 防护工具 ====================

  /**
   * HTML 转义 — 防止 XSS 攻击
   * 将所有用户数据在插入 innerHTML 前进行安全转义
   * @param {string} str - 待转义的字符串
   * @returns {string} 转义后的安全字符串
   */
  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ==================== 音效引擎（Web Audio API 程序化合成） ====================

  /**
   * SoundEngine — 微交互音效系统
   *
   * 设计理念（对标库洛/网易旗舰产品 micro-audio 标准）：
   * - 使用 Web Audio API 程序化合成音效，零外部音频文件依赖
   * - 全部音效 ≤ 0.3s，短促不干扰，营造沉浸感而非噪音
   * - 尊重 prefers-reduced-motion：用户偏好减少动画时自动禁用音效
   * - 尊重浏览器自动播放策略：AudioContext 在首次用户手势后恢复
   * - 静音偏好持久化到 localStorage，跨会话保持一致
   * - hover 音效带节流，避免快速滑动时音效叠加
   *
   * 音效清单（5 种）：
   * - hover  : 轻柔风铃 — 双泛音正弦波，880-1000Hz 随机微调
   * - click  : 水滴声 — 频率下滑 900→350Hz + 高频泛音点缀
   * - toggle : 猫叫声 — 双段频率滑移 420→620→380Hz（猫系灵魂）
   * - switch : 月份切换 — 带通滤波白噪声 + 低频正弦"唰"声
   * - open   : 内容展开 — 上行五度音程 C5→G5 温柔"叮咚"
   */
  var SoundEngine = (function () {
    var audioCtx = null;
    var masterGain = null;
    var muted = false;
    var initialized = false;
    var lastHoverTime = 0;
    var HOVER_THROTTLE = 80; // ms — 防止 hover 音效过于频繁

    // 检测 prefers-reduced-motion：用户减少动画偏好时禁用音效
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 从 localStorage 读取静音偏好（跨会话持久化）
    try {
      muted = localStorage.getItem('kevi_sound_muted') === 'true';
    } catch (e) {
      muted = false;
    }

    /**
     * 初始化 AudioContext（延迟到首次用户手势后调用）
     */
    function init() {
      if (initialized) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return; // 浏览器不支持 Web Audio API，静默降级
        audioCtx = new AC();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = muted ? 0 : 0.25; // 主音量 25%，轻柔不刺耳
        masterGain.connect(audioCtx.destination);
        initialized = true;
      } catch (e) {
        // Web Audio API 初始化失败，静默降级（不影响页面功能）
      }
    }

    /**
     * 恢复被浏览器暂停的 AudioContext（自动播放策略）
     */
    function resume() {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }

    /**
     * 设置静音状态并持久化
     * @param {boolean} value - 是否静音
     */
    function setMuted(value) {
      muted = value;
      try {
        localStorage.setItem('kevi_sound_muted', String(muted));
      } catch (e) {
        // localStorage 不可用时仅影响当前会话
      }
      if (masterGain) {
        masterGain.gain.value = muted ? 0 : 0.25;
      }
    }

    /**
     * 获取当前静音状态
     * @returns {boolean}
     */
    function isMuted() {
      return muted;
    }

    /**
     * 检查音效是否可播放（已初始化 + 未静音 + 未偏好减少动画）
     * @returns {boolean}
     */
    function canPlay() {
      if (!initialized || muted || prefersReducedMotion) return false;
      if (audioCtx.state === 'suspended') resume();
      return true;
    }

    /**
     * 合成单个带 ADSR 包络的振荡器音
     * @param {number} freq - 起始频率
     * @param {number} duration - 持续时间（秒）
     * @param {string} type - 波形类型 'sine' | 'triangle' | 'square' | 'sawtooth'
     * @param {number} volume - 音量 0-1
     * @param {number} [freqEnd] - 结束频率（用于频率滑移效果）
     */
    function playTone(freq, duration, type, volume, freqEnd) {
      if (!canPlay()) return;

      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd && freqEnd > 0) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
      }

      // ADSR 包络：快速 attack + 指数 decay
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }

    // ==================== 音效合成器 ====================

    /**
     * hover — 轻柔风铃声
     * 双泛音正弦波叠加，频率随机微调避免单调
     * 时长 ≤ 0.15s，带 80ms 节流
     */
    function playHover() {
      if (!canPlay()) return;
      var now = performance.now();
      if (now - lastHoverTime < HOVER_THROTTLE) return;
      lastHoverTime = now;

      var baseFreq = 880 + Math.random() * 120; // 880-1000Hz 随机变化
      playTone(baseFreq, 0.15, 'sine', 0.1);
      // 第二泛音（五度音程），增加风铃的丰富感
      setTimeout(function () {
        playTone(baseFreq * 1.5, 0.12, 'sine', 0.05);
      }, 30);
    }

    /**
     * click — 水滴声
     * 频率从 900Hz 快速下滑至 350Hz，配合高频泛音点缀
     * 时长 ≤ 0.12s
     */
    function playClick() {
      if (!canPlay()) return;
      playTone(900, 0.12, 'sine', 0.15, 350);
      // 高频"泛音"模拟水滴清脆感
      setTimeout(function () {
        playTone(1800, 0.04, 'triangle', 0.03);
      }, 10);
    }

    /**
     * toggle — 猫叫声
     * 双段频率滑移 420→620→380Hz，模拟"喵~"的音调起伏
     * 时长 ≤ 0.3s（猫系灵魂专属音效）
     */
    function playToggle() {
      if (!canPlay()) return;
      // 第一段：低→高（"喵"的上扬）
      playTone(420, 0.15, 'sine', 0.13, 620);
      // 第二段：高→低（"~"的收尾）
      setTimeout(function () {
        playTone(620, 0.18, 'sine', 0.1, 380);
      }, 120);
    }

    /**
     * switch — 月份切换/页面切换
     * 带通滤波白噪声 + 低频正弦，营造轻柔"唰"声
     * 时长 ≤ 0.2s
     */
    function playSwitch() {
      if (!canPlay()) return;

      var now = audioCtx.currentTime;
      var duration = 0.2;

      // 生成白噪声缓冲区
      var bufferSize = audioCtx.sampleRate * duration;
      var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      var noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      // 带通滤波器 — 只保留中频，营造"唰"的质感
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.8;

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(now);
      noise.stop(now + duration + 0.05);

      // 配合低频正弦增加"厚度"
      playTone(200, 0.15, 'sine', 0.05, 120);
    }

    /**
     * open — 内容展开
     * 上行五度音程 C5→G5，温柔的"叮咚"感
     * 时长 ≤ 0.25s
     */
    function playOpen() {
      if (!canPlay()) return;
      playTone(523, 0.15, 'sine', 0.1); // C5
      setTimeout(function () {
        playTone(784, 0.2, 'sine', 0.08); // G5（五度上方）
      }, 80);
    }

    /**
     * playMeow — 猫爪彩蛋猫叫
     * 活泼撒娇感：450→550→380Hz 主声线 + 1100→1600→900Hz 泛音层
     * 时长 ~0.35s，音量 0.08，带三角形波泛音模拟真猫发声的毛发质感
     */
    function playMeow() {
      if (!canPlay()) return;
      var now = audioCtx.currentTime;

      // 主声线：450Hz 上扬至 550Hz，再下滑至 380Hz（"喵↗↘"）
      var osc1 = audioCtx.createOscillator();
      var gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(450, now);
      osc1.frequency.linearRampToValueAtTime(550, now + 0.12);
      osc1.frequency.linearRampToValueAtTime(380, now + 0.35);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.42);

      // 泛音层：高频毛发感，三角形波增加真实猫叫的"毛边"质感
      var osc2 = audioCtx.createOscillator();
      var gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1100, now);
      osc2.frequency.linearRampToValueAtTime(1600, now + 0.15);
      osc2.frequency.linearRampToValueAtTime(900, now + 0.35);
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.linearRampToValueAtTime(0.025, now + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now);
      osc2.stop(now + 0.40);
    }

    // ==================== 彩蛋音效合成器（P3 — 六彩蛋方案 B：Web Audio API 合成） ====================

    /**
     * 彩蛋① 猫爪五连击 — 短促可爱的"喵"（~1.2s）
     * 双振荡器（基频 sin + 泛音 triangle）+ 频率滑音模拟猫叫上扬再下降
     * 比常规 UI 音效高 3dB，突出彩蛋感
     */
    function playEasterEggMeow() {
      if (!canPlay()) return;
      var now = audioCtx.currentTime;
      var masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.65, now + 0.03);
      masterGain.gain.linearRampToValueAtTime(0.5, now + 0.6);
      masterGain.gain.linearRampToValueAtTime(0, now + 1.2);

      var osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(380, now);
      osc1.frequency.linearRampToValueAtTime(620, now + 0.15);
      osc1.frequency.linearRampToValueAtTime(280, now + 0.7);
      osc1.frequency.linearRampToValueAtTime(150, now + 1.0);

      var osc2 = audioCtx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(760, now);
      osc2.frequency.linearRampToValueAtTime(1240, now + 0.12);
      osc2.frequency.linearRampToValueAtTime(320, now + 0.65);
      osc2.frequency.linearRampToValueAtTime(100, now + 0.95);

      var gain1 = audioCtx.createGain();
      gain1.gain.setValueAtTime(0.55, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.9);
      var gain2 = audioCtx.createGain();
      gain2.gain.setValueAtTime(0.15, now);
      gain2.gain.linearRampToValueAtTime(0, now + 0.8);

      osc1.connect(gain1).connect(masterGain);
      osc2.connect(gain2).connect(masterGain);
      osc1.start(now); osc2.start(now);
      osc1.stop(now + 1.2); osc2.stop(now + 1.2);
    }

    /**
     * 彩蛋② "nya" 暗号 — 魔法铃铛"叮"（~0.8s）
     * 三个三角波振荡器（A6/E7/A7 根音+五度+八度）依次延迟触发
     */
    function playNyaChime() {
      if (!canPlay()) return;
      var now = audioCtx.currentTime;
      var masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.35, now + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      var freqs = [1760, 2640, 3520]; // A6, E7, A7
      var delays = [0, 0.04, 0.08];
      for (var i = 0; i < 3; i++) {
        var osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freqs[i], now + delays[i]);
        var gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3 - i * 0.08, now + delays[i] + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delays[i] + 0.5);
        osc.connect(gain).connect(masterGain);
        osc.start(now + delays[i]);
        osc.stop(now + delays[i] + 0.6);
      }
    }

    /**
     * 彩蛋③ 午夜花园 — 夜间环境底噪层（极简白噪声 + 低通滤波）
     * 返回 { source, gain } 供后续销毁
     */
    var nightAmbienceNodes = null;
    function createNightAmbience() {
      if (!audioCtx) return null;
      // 先销毁旧的环境音
      destroyNightAmbience();
      var bufferSize = 2 * audioCtx.sampleRate;
      var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.02;
      }
      var source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, audioCtx.currentTime);
      filter.Q.setValueAtTime(2, audioCtx.currentTime);
      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 3); // 3s渐入
      source.connect(filter).connect(gain).connect(audioCtx.destination);
      source.start();
      nightAmbienceNodes = { source: source, gain: gain };
      return nightAmbienceNodes;
    }

    function destroyNightAmbience() {
      if (!nightAmbienceNodes) return;
      var now = audioCtx ? audioCtx.currentTime : 0;
      try {
        nightAmbienceNodes.gain.gain.linearRampToValueAtTime(0, now + 1.5);
        setTimeout(function () {
          try { nightAmbienceNodes.source.stop(); } catch (e) {}
          nightAmbienceNodes = null;
        }, 1600);
      } catch (e) {
        nightAmbienceNodes = null;
      }
    }

    function isNightAmbienceActive() {
      return nightAmbienceNodes !== null;
    }

    /**
     * 彩蛋④ BGM 隐藏曲目 — Lo-Fi 钢琴 C-G-Am-F（15s，~75BPM）
     * 多正弦波叠加和弦 + 黑胶噪点层 + 第7秒喵点缀
     * 返回 { masterGain, stop } 供 BgmEngine 管理生命周期
     */
    function playEasterEggBgm() {
      if (!canPlay()) return null;
      var now = audioCtx.currentTime;
      var masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.25, now + 0.5);
      masterGain.gain.linearRampToValueAtTime(0.25, now + 14);
      masterGain.gain.linearRampToValueAtTime(0, now + 15);

      var chords = [
        { notes: [261.6, 329.6, 392.0], time: 0 },
        { notes: [196.0, 246.9, 329.6], time: 3.75 },
        { notes: [220.0, 261.6, 329.6], time: 7.5 },
        { notes: [174.6, 220.0, 261.6], time: 11.25 }
      ];

      chords.forEach(function (chord) {
        chord.notes.forEach(function (freq) {
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + chord.time);
          var gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0, now + chord.time);
          gain.gain.linearRampToValueAtTime(0.12, now + chord.time + 0.2);
          gain.gain.linearRampToValueAtTime(0.08, now + chord.time + 3.5);
          gain.gain.linearRampToValueAtTime(0, now + chord.time + 3.75);
          osc.connect(gain).connect(masterGain);
          osc.start(now + chord.time);
          osc.stop(now + chord.time + 3.75);
        });
      });

      // Lo-Fi 黑胶噪点层
      var noiseBufferSize = 4 * audioCtx.sampleRate;
      var noiseBuffer = audioCtx.createBuffer(1, noiseBufferSize, audioCtx.sampleRate);
      var noiseData = noiseBuffer.getChannelData(0);
      for (var j = 0; j < noiseBufferSize; j++) {
        noiseData[j] = (Math.random() * 2 - 1) * 0.015;
      }
      var noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      var noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.04, now);
      noiseGain.gain.linearRampToValueAtTime(0.04, now + 14);
      noiseGain.gain.linearRampToValueAtTime(0, now + 15);
      noise.connect(noiseGain).connect(masterGain);
      noise.start(now);
      noise.stop(now + 15);

      // 第7秒插入轻声喵点缀
      setTimeout(function () {
        if (!audioCtx || muted) return;
        var meowNow = audioCtx.currentTime;
        var meowGain = audioCtx.createGain();
        meowGain.connect(audioCtx.destination);
        meowGain.gain.setValueAtTime(0, meowNow);
        meowGain.gain.linearRampToValueAtTime(0.08, meowNow + 0.02);
        meowGain.gain.linearRampToValueAtTime(0.05, meowNow + 0.4);
        meowGain.gain.linearRampToValueAtTime(0, meowNow + 0.8);

        var mo = audioCtx.createOscillator();
        mo.type = 'sine';
        mo.frequency.setValueAtTime(420, meowNow);
        mo.frequency.linearRampToValueAtTime(580, meowNow + 0.12);
        mo.frequency.linearRampToValueAtTime(320, meowNow + 0.5);
        mo.connect(meowGain);
        mo.start(meowNow);
        mo.stop(meowNow + 0.55);
      }, 7000);

      return {
        masterGain: masterGain,
        stop: function () {
          try {
            masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            setTimeout(function () {
              try { noise.stop(); } catch (e) {}
            }, 400);
          } catch (e) {}
        }
      };
    }

    /**
     * 彩蛋⑤ 访客留言瓶 — 瓶塞弹出音效（~0.5s）
     * 低频正弦波从 180Hz 上扬至 360Hz，温暖"噗"感
     */
    function playBottleOpen() {
      if (!canPlay()) return;
      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.15);
      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    }

    /**
     * 彩蛋⑤ 访客留言瓶 — 确认提交音效（~0.5s）
     * 两个三角波上行音符 C5→E5，"叮-咚"感
     */
    function playBottleSubmit() {
      if (!canPlay()) return;
      var now = audioCtx.currentTime;
      var notes = [523, 659]; // C5, E5
      notes.forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        var gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.5);
      });
    }

    /**
     * 彩蛋⑥ 页脚心形碎裂 — 3拍心跳 + 高频碎裂（~1.5s）
     * 低频50Hz正弦脉冲 × 3 + 高通滤波白噪声碎裂爆裂
     */
    function playHeartBurst() {
      if (!canPlay()) return;
      var now = audioCtx.currentTime;
      var masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      masterGain.gain.setValueAtTime(0.4, now);

      // 三拍心跳 — 低频短脉冲（咚-咚-咚，间隔0.25s）
      for (var i = 0; i < 3; i++) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, now + i * 0.25);
        var gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, now + i * 0.25);
        gain.gain.linearRampToValueAtTime(0.8, now + i * 0.25 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.2);
        osc.connect(gain).connect(masterGain);
        osc.start(now + i * 0.25);
        osc.stop(now + i * 0.25 + 0.25);
      }

      // 碎裂层 — 高通滤波白噪声（在心跳后 0.8s 触发）
      var bufferSize = Math.floor(0.6 * audioCtx.sampleRate);
      var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var k = 0; k < bufferSize; k++) {
        var t = k / audioCtx.sampleRate;
        data[k] = (Math.random() * 2 - 1) * Math.max(0, 1 - t * 3) * 0.4;
      }
      var noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3000, now + 0.8);
      var noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.35, now + 0.8);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      noise.connect(filter).connect(noiseGain).connect(masterGain);
      noise.start(now + 0.8);
      noise.stop(now + 1.5);
    }

    return {
      init: init,
      resume: resume,
      setMuted: setMuted,
      isMuted: isMuted,
      canPlay: canPlay,
      playHover: playHover,
      playClick: playClick,
      playToggle: playToggle,
      playSwitch: playSwitch,
      playOpen: playOpen,
      playMeow: playMeow,
      // 暴露 AudioContext 供 BgmEngine 共用
      getContext: function () { return audioCtx; },
      isInitialized: function () { return initialized; },
      // 彩蛋音效合成器（P3）
      playEasterEggMeow: playEasterEggMeow,
      playNyaChime: playNyaChime,
      createNightAmbience: createNightAmbience,
      destroyNightAmbience: destroyNightAmbience,
      isNightAmbienceActive: isNightAmbienceActive,
      playEasterEggBgm: playEasterEggBgm,
      playBottleOpen: playBottleOpen,
      playBottleSubmit: playBottleSubmit,
      playHeartBurst: playHeartBurst,
    };
  })();

  // ==================== 背景音乐引擎（BGM Engine — P2） ====================

  /**
   * BgmEngine — 生成式环境音乐引擎
   *
   * 设计理念：
   * - 使用 Web Audio API 程序化生成治愈系环境音乐，零外部音频文件
   * - 双页面差异化：Page A「花园深处」温暖私密 / Page B「花园入口」开放轻快
   * - 钢琴和弦 + 铃铛点缀 + lo-fi 噪感纹理 + 猫元素随机触发
   * - 120s 循环周期，自动 crossfade 切换
   * - 与 SoundEngine 共享 AudioContext，独立 GainNode 控制音量
   * - 默认静音（尊重用户），需手动点击 BGM 按钮开启
   */
  var BgmEngine = (function () {
    var audioCtx = null;
    var bgmGain = null;        // BGM 独立增益节点
    var playing = false;       // 是否在播放
    var started = false;       // 是否已启动过
    var currentPage = null;    // 'a' | 'b' | null
    var currentVariant = 'default'; // 'default' | 'night' | 'easter-egg'
    var muted = true;          // 默认静音
    var volume = 0.45;         // 默认音量 45%
    var crossfading = false;

    // 活跃的振荡器/节点列表（用于清理）
    var activeNodes = [];
    var chordTimer = null;
    var bellTimer = null;
    var catTimer = null;

    // 检测减少动画偏好
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 从 localStorage 读取 BGM 偏好
    try {
      muted = localStorage.getItem('kevi_bgm_muted') === 'true'; // 默认播放（仅显式设为 true 时静音）
      var savedVol = parseFloat(localStorage.getItem('kevi_bgm_volume'));
      if (!isNaN(savedVol) && savedVol >= 0 && savedVol <= 1) {
        volume = savedVol;
      }
    } catch (e) {
      muted = true;
      volume = 0.45;
    }

    /**
     * 初始化（需要 SoundEngine 的 AudioContext）
     */
    function init() {
      if (started) return;
      var ctx = SoundEngine.getContext();
      if (!ctx) return;
      audioCtx = ctx;
      bgmGain = audioCtx.createGain();
      bgmGain.gain.value = muted ? 0 : volume;
      bgmGain.connect(audioCtx.destination);
      started = true;
    }

    /**
     * 开始播放指定页面的 BGM
     * @param {string} page - 'a' | 'b'
     */
    function play(page, variant) {
      if (!started || prefersReducedMotion || muted) return;
      variant = variant || 'default';
      if (page === currentPage && playing && currentVariant === variant) return;

      // 如果 AudioContext 被暂停，恢复
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      if (currentPage && currentPage !== page) {
        // 页面切换：crossfade
        crossfadeTo(page, variant);
        return;
      }

      currentPage = page;
      currentVariant = variant;
      playing = true;
      if (variant === 'night') {
        scheduleNightMusic(page);
      } else {
        scheduleMusic(page);
      }
      scheduleCatElements(page);
    }

    var lastPage = null; // 保存暂停前的页面，用于 resume

    /**
     * 暂停 BGM
     */
    function pause() {
      lastPage = currentPage;
      playing = false;
      stopAllMusic();
      currentPage = null;
    }

    /**
     * crossfade 到新页面 BGM（0.8s 过渡）
     * @param {string} newPage - 'a' | 'b'
     */
    function crossfadeTo(newPage, variant) {
      if (crossfading) return;
      crossfading = true;
      variant = variant || 'default';

      // 当前音乐 0.8s 淡出
      var fadeStart = audioCtx.currentTime;
      var tempGain = bgmGain;
      var originalVolume = muted ? 0 : volume;
      tempGain.gain.setValueAtTime(originalVolume, fadeStart);
      tempGain.gain.linearRampToValueAtTime(0.001, fadeStart + 0.8);

      // 0.4s 后停止旧音乐，启动新音乐
      setTimeout(function () {
        stopAllMusic();
        currentPage = newPage;

        // 0.4s 后新音乐淡入（总计 0.8s crossfade）
        setTimeout(function () {
          currentVariant = variant;
          if (variant === 'night') {
            scheduleNightMusic(newPage);
          } else {
            scheduleMusic(newPage);
          }
          scheduleCatElements(newPage);
          playing = true;
          bgmGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
          bgmGain.gain.linearRampToValueAtTime(originalVolume, audioCtx.currentTime + 0.4);
          crossfading = false;
        }, 400);
      }, 200);
    }

    /**
     * 停止所有音乐（清理振荡器、停止调度器）
     */
    function stopAllMusic() {
      clearInterval(chordTimer);
      clearInterval(bellTimer);
      clearTimeout(catTimer);
      chordTimer = null;
      bellTimer = null;
      catTimer = null;

      // 停止所有活跃的振荡器
      activeNodes.forEach(function (node) {
        try { node.stop(); } catch (e) { /* 已停止 */ }
      });
      activeNodes = [];
    }

    /**
     * 调度钢琴和弦 + 铃铛
     * @param {string} page - 'a' | 'b'
     */
    function scheduleMusic(page) {
      if (!playing || !started) return;

      var isPageA = page === 'a';

      // Page A 和弦进行：Cmaj7 → Am7 → Fmaj7 → G7（温暖私密）
      // Page B 和弦进行：Gmaj7 → Em7 → Cmaj7 → D7（明亮开放在 G 大调）
      var chordsA = [
        [261.63, 329.63, 392.00, 493.88], // Cmaj7: C E G B
        [220.00, 261.63, 329.63, 392.00], // Am7:  A C E G
        [174.61, 220.00, 261.63, 349.23], // Fmaj7: F A C E
        [196.00, 246.94, 293.66, 349.23], // G7:   G B D F
      ];
      var chordsB = [
        [196.00, 246.94, 293.66, 369.99], // Gmaj7: G B D F#
        [164.81, 196.00, 246.94, 293.66], // Em7:   E G B D
        [261.63, 329.63, 392.00, 493.88], // Cmaj7: C E G B
        [293.66, 369.99, 440.00, 523.25], // D7:    D F# A C
      ];
      var chords = isPageA ? chordsA : chordsB;
      var chordDuration = isPageA ? 7.5 : 6.5; // Page A 更长更舒缓
      var bellFreq = isPageA ? 0.35 : 0.25;    // Page A 铃铛频率更高
      var chordIndex = 0;

      // 立即播放第一个和弦
      playChord(chords[chordIndex], chordDuration, isPageA);

      // 定时播放后续和弦（15s 周期 = 4 和弦 × 和弦时长 → 约 28-30s）
      chordTimer = setInterval(function () {
        chordIndex = (chordIndex + 1) % chords.length;
        playChord(chords[chordIndex], chordDuration, isPageA);
      }, chordDuration * 1000);

      // 铃铛点缀：随机高音点缀
      scheduleBells(bellFreq, isPageA);
    }

    /**
     * 夜间 BGM 变奏 — 降低 BPM、延长音符时值、纯 sine 波
     */
    function scheduleNightMusic(page) {
      if (!playing || !started) return;
      var isPageA = page === 'a';
      var chordsA = [[261.63,329.63,392.00,493.88],[220.00,261.63,329.63,392.00],[174.61,220.00,261.63,349.23],[196.00,246.94,293.66,349.23]];
      var chordsB = [[196.00,246.94,293.66,369.99],[164.81,196.00,246.94,293.66],[261.63,329.63,392.00,493.88],[293.66,369.99,440.00,523.25]];
      var chords = isPageA ? chordsA : chordsB;
      var chordDuration = 12, bellFreq = 0.15, chordIndex = 0;
      playNightChord(chords[chordIndex], chordDuration);
      chordTimer = setInterval(function () {
        chordIndex = (chordIndex + 1) % chords.length;
        playNightChord(chords[chordIndex], chordDuration);
      }, chordDuration * 1000);
      scheduleBells(bellFreq, true);
    }

    function playNightChord(freqs, duration) {
      if (!audioCtx || audioCtx.state === 'suspended') return;
      var now = audioCtx.currentTime;
      freqs.forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04 / (i + 1), now + 0.6);
        gain.gain.setValueAtTime(0.04 / (i + 1), now + duration - 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain); gain.connect(bgmGain);
        osc.start(now); osc.stop(now + duration + 0.5);
        activeNodes.push(osc);
      });
    }

    /**
     * 播放钢琴和弦（多层泛音叠加模拟钢琴质感）
     * @param {number[]} freqs - 和弦频率数组
     * @param {number} duration - 持续时间(秒)
     * @param {boolean} isPageA - 是否 Page A
     */
    function playChord(freqs, duration, isPageA) {
      if (!audioCtx || audioCtx.state === 'suspended') return;
      var now = audioCtx.currentTime;

      freqs.forEach(function (freq, i) {
        // 基音（柔和正弦波）
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        // 稍微 detune 模拟 lo-fi 温暖感
        if (isPageA) {
          osc.detune.value = (Math.random() - 0.5) * 8; // ±4 cent
        }
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.06 / (i + 1), now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(bgmGain);
        osc.start(now);
        osc.stop(now + duration + 0.5);
        activeNodes.push(osc);

        // 泛音层（模拟钢琴泛音）
        var harmOsc = audioCtx.createOscillator();
        var harmGain = audioCtx.createGain();
        harmOsc.type = 'triangle';
        harmOsc.frequency.value = freq * 2;
        harmGain.gain.setValueAtTime(0, now);
        harmGain.gain.linearRampToValueAtTime(0.02 / (i + 1), now + 0.3);
        harmGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7);
        harmOsc.connect(harmGain);
        harmGain.connect(bgmGain);
        harmOsc.start(now);
        harmOsc.stop(now + duration + 0.3);
        activeNodes.push(harmOsc);
      });
    }

    /**
     * 铃铛点缀调度器
     * @param {number} freq - 每秒触发概率
     * @param {boolean} isPageA
     */
    function scheduleBells(probability, isPageA) {
      bellTimer = setInterval(function () {
        if (!playing || !audioCtx || audioCtx.state === 'suspended') return;
        if (Math.random() < probability) {
          playBell(isPageA);
        }
      }, 1500); // 每 1.5s 检查一次
    }

    /**
     * 播放单个铃铛音
     */
    function playBell(isPageA) {
      var now = audioCtx.currentTime;
      var baseFreq = 800 + Math.random() * 1200; // 800-2000Hz

      // 双泛音铃铛
      [1, 1.5].forEach(function (mult) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = baseFreq * mult;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(isPageA ? 0.04 : 0.03, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + Math.random() * 0.2);
        osc.connect(gain);
        gain.connect(bgmGain);
        osc.start(now);
        osc.stop(now + 0.5);
        activeNodes.push(osc);
      });
    }

    /**
     * 调度猫元素随机触发
     * Page A: 每 30-60s / Page B: 每 90-120s
     * @param {string} page - 'a' | 'b'
     */
    function scheduleCatElements(page) {
      var isPageA = page === 'a';
      var minInterval = isPageA ? 30000 : 90000;
      var maxInterval = isPageA ? 60000 : 120000;

      function scheduleNext() {
        if (!playing) return;
        var delay = minInterval + Math.random() * (maxInterval - minInterval);
        catTimer = setTimeout(function () {
          if (!playing) return;
          // 80% 呼噜声 + 20% 轻声喵叫
          if (Math.random() < 0.8) {
            playPurr();
          } else {
            playSoftMeow();
          }
          scheduleNext();
        }, delay);
      }

      scheduleNext();
    }

    /**
     * 猫呼噜声（30-60Hz 低频 + 振幅调制）
     */
    function playPurr() {
      if (!audioCtx || audioCtx.state === 'suspended') return;
      var now = audioCtx.currentTime;
      var duration = 3 + Math.random() * 2;

      // 基底低频
      var osc = audioCtx.createOscillator();
      var modOsc = audioCtx.createOscillator();
      var modGain = audioCtx.createGain();
      var gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = 45; // 低频呼噜
      modOsc.type = 'sine';
      modOsc.frequency.value = 25; // 25Hz 调制频率
      modGain.gain.value = 15; // 调制深度
      modOsc.connect(modGain);
      modGain.connect(osc.frequency); // 频率调制

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.3);
      gain.gain.setValueAtTime(0.08, now + duration - 0.3);
      gain.gain.linearRampToValueAtTime(0, now + duration);

      osc.connect(gain);
      gain.connect(bgmGain);
      osc.start(now);
      modOsc.start(now);
      osc.stop(now + duration + 0.1);
      modOsc.stop(now + duration + 0.1);
      activeNodes.push(osc, modOsc);
    }

    /**
     * 轻声喵叫（比 SFX 版更轻柔）
     */
    function playSoftMeow() {
      if (!audioCtx || audioCtx.state === 'suspended') return;
      var now = audioCtx.currentTime;

      function meowTone(freq, endFreq, duration, vol, delay) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + delay + duration);
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(vol, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
        osc.connect(gain);
        gain.connect(bgmGain);
        osc.start(now + delay);
        osc.stop(now + delay + duration + 0.05);
        activeNodes.push(osc);
      }

      meowTone(350, 500, 0.2, 0.06, 0);
      meowTone(500, 320, 0.25, 0.04, 0.18);
    }

    /**
     * 设置静音状态
     */
    function setMuted(value) {
      muted = value;
      try {
        localStorage.setItem('kevi_bgm_muted', String(muted));
      } catch (e) {}
      if (bgmGain) {
        bgmGain.gain.value = muted ? 0 : volume;
      }
      if (muted) {
        pause();
      }
    }

    /**
     * 获取静音状态
     */
    function isMuted() {
      return muted;
    }

    /**
     * 设置音量
     * @param {number} val - 0-1
     */
    function setVolume(val) {
      volume = Math.max(0, Math.min(1, val));
      try {
        localStorage.setItem('kevi_bgm_volume', String(volume));
      } catch (e) {}
      if (bgmGain && !muted) {
        bgmGain.gain.value = volume;
      }
    }

    /**
     * 获取音量
     */
    function getVolume() {
      return volume;
    }

    /**
     * 获取当前播放的页面
     */
    function getCurrentPage() {
      return currentPage;
    }

    /**
     * 是否正在播放
     */
    function isPlaying() {
      return playing;
    }

    /**
     * 恢复 AudioContext 并重新开始播放
     */
    function resume() {
      if (!started || muted) return;
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (currentPage && !playing) {
        playing = true;
        if (currentVariant === 'night') {
          scheduleNightMusic(currentPage);
        } else {
          scheduleMusic(currentPage);
        }
        scheduleCatElements(currentPage);
      }
    }

    /**
     * 夜间模式切换 — 供午夜花园彩蛋调用
     * @param {boolean} enable - true 切换夜间，false 切回白天
     */
    function setNightMode(enable) {
      if (!started || !currentPage) return;
      if (enable && currentVariant !== 'night') {
        // 切换到夜间变奏
        var wasPlaying = playing;
        stopAllMusic();
        currentVariant = 'night';
        if (wasPlaying) {
          playing = true;
          scheduleNightMusic(currentPage);
          scheduleCatElements(currentPage);
        }
      } else if (!enable && currentVariant === 'night') {
        // 切回白天
        var wasPlaying2 = playing;
        stopAllMusic();
        currentVariant = 'default';
        if (wasPlaying2) {
          playing = true;
          scheduleMusic(currentPage);
          scheduleCatElements(currentPage);
        }
      }
    }

    /**
     * 播放彩蛋隐藏曲目 - Lo-Fi 钢琴（~15s）
     * 委托给 SoundEngine.playEasterEggBgm()
     */
    function playEasterEggTrack() {
      // 暂停当前 BGM
      var wasPlaying = playing;
      if (wasPlaying) {
        stopAllMusic();
        playing = false;
      }

      var track = SoundEngine.playEasterEggBgm();
      if (!track) return;

      // 15s 后恢复
      setTimeout(function () {
        try { track.stop(); } catch (e) {}
        if (wasPlaying && currentPage && !muted) {
          playing = true;
          if (currentVariant === 'night') {
            scheduleNightMusic(currentPage);
          } else {
            scheduleMusic(currentPage);
          }
          scheduleCatElements(currentPage);
        }
      }, 15000);
    }

    // 页面不可见时暂停 BGM
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && playing) {
        stopAllMusic();
      } else if (!document.hidden && playing && currentPage && !muted) {
        if (currentVariant === 'night') {
          scheduleNightMusic(currentPage);
        } else {
          scheduleMusic(currentPage);
        }
        scheduleCatElements(currentPage);
      }
    });

    return {
      init: init,
      play: play,
      pause: pause,
      resume: resume,
      setMuted: setMuted,
      isMuted: isMuted,
      setVolume: setVolume,
      getVolume: getVolume,
      getCurrentPage: getCurrentPage,
      isPlaying: isPlaying,
      isStarted: function () { return started; },
      setNightMode: setNightMode,
      playEasterEggTrack: playEasterEggTrack,
    };
  })();

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

  // ==================== 首屏 Cinematic 加载序列（P0 #5） ====================
  // 四段式编排：背景渐变淡入(0.3s) → 粒子中心扩散(0.5s) → 头像光圈展开(0.4s) → 卡片 stagger 入场(0.6s)
  // 总时长 ≤ 2s，prefers-reduced-motion 时跳过
  // 声效联动：粒子扩散时播放爆发音效

  function initCinematicIntro() {
    var preloader = document.getElementById('cinematic-preloader');
    if (!preloader) return Promise.resolve();

    // 检测减少动画偏好：跳过 cinematic 序列
    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      preloader.style.display = 'none';
      return Promise.resolve();
    }

    // 回访用户跳过动画（同一 sessionStorage 内已看过）
    var SKIP_KEY = 'kevi_home_preloader_skip';
    function shouldSkipPreloader() {
      try { return window.sessionStorage.getItem(SKIP_KEY) === '1'; } catch (e) { return false; }
    }
    function markPreloaderShown() {
      try { window.sessionStorage.setItem(SKIP_KEY, '1'); } catch (e) {}
    }
    if (shouldSkipPreloader()) {
      preloader.classList.add('skip-immediate');
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      // Phase 2：生成粒子爆发元素（14 个，均匀辐射）
      var burst = document.getElementById('preloader-burst');
      if (burst) {
        var particleCount = 14;
        var colors = [
          'rgba(255, 158, 190, 0.9)',
          'rgba(200, 162, 224, 0.9)',
          'rgba(248, 179, 209, 0.9)',
          'rgba(221, 214, 254, 0.9)',
          'rgba(255, 220, 235, 0.9)',
        ];
        for (var i = 0; i < particleCount; i++) {
          var particle = document.createElement('span');
          particle.className = 'preloader-particle';
          var angle = (i / particleCount) * Math.PI * 2;
          var distance = 120 + Math.random() * 80;
          var tx = Math.cos(angle) * distance;
          var ty = Math.sin(angle) * distance;
          particle.style.setProperty('--tx', tx + 'px');
          particle.style.setProperty('--ty', ty + 'px');
          particle.style.background = colors[i % colors.length];
          var size = 4 + Math.random() * 6;
          particle.style.width = size + 'px';
          particle.style.height = size + 'px';
          burst.appendChild(particle);
        }
      }

      // Phase 3：触发头像光圈展开（1.3s 时）
      setTimeout(function () {
        var avatarGlow = document.querySelector('.page:not(.hidden) .avatar-glow');
        if (avatarGlow) {
          avatarGlow.classList.add('cinematic-active');
        }
      }, 1300);

      // Phase 4：触发卡片 stagger 入场（1.5s 时）
      setTimeout(function () {
        var visiblePage = document.querySelector('.page:not(.hidden)');
        if (visiblePage) {
          var fadeElements = visiblePage.querySelectorAll('.fade-in-up');
          fadeElements.forEach(function (el) {
            el.classList.add('visible');
          });
        }
      }, 1500);

      // 淡出 preloader（1.8s 时开始，0.3s 淡出）
      setTimeout(function () {
        preloader.classList.add('fade-out');
      }, 1800);

      // 序列完成（2.2s），移除 preloader 并 resolve
      setTimeout(function () {
        markPreloaderShown();
        if (preloader.parentNode) {
          preloader.parentNode.removeChild(preloader);
        }
        resolve();
      }, 2200);
    });
  }

  // ==================== 动效编排系统 Choreographer（P1 #8） ====================
  // 三层时序协议：场景级(0.5s) → 容器级(0.06s stagger) → 元素级(0.25s hover)
  // "信号灯"编排：先背景 → 再容器 → 最后内容，形成视觉叙事
  // 声效与动效联动：在关键编排节点触发对应音效

  var Choreographer = {
    /**
     * 场景级编排 — 页面切换
     * 协调背景层过渡、容器入场、内容 stagger 的时序
     * 在页面切换时播放柔风音效 + 延迟触发滚动动画
     */
    sceneTransition: function () {
      // 场景级音效
      SoundEngine.playSwitch();

      // 容器级：延迟触发卡片 stagger（等页面淡入完成后开始）
      setTimeout(function () {
        initScrollAnimation();
      }, 200);
    },

    /**
     * 容器级编排 — 动态渲染内容 stagger 入场
     * 为动态渲染的子元素附加依次入场动画
     * @param {HTMLElement} container - 内容容器
     * @param {number} baseDelay - 基础延迟(ms)
     */
    staggerEnter: function (container, baseDelay) {
      if (!container) return;
      var items = container.children;
      for (var i = 0; i < items.length; i++) {
        (function (item, index) {
          item.classList.add('choreo-enter');
          setTimeout(function () {
            item.classList.add('choreo-visible');
          }, (baseDelay || 0) + index * 60); // 0.06s stagger
        })(items[i], i);
      }
    },

    /**
     * 元素级编排 — toggle 反馈（日历月份切换、日期选择等）
     */
    onToggle: function () {
      SoundEngine.playToggle();
    },

    /**
     * 元素级编排 — open 反馈（详情面板展开）
     */
    onOpen: function () {
      SoundEngine.playOpen();
    },
  };

  // ==================== 猫爪彩蛋（P2） ====================

  /**
   * 猫爪彩蛋 — 点击背景猫爪触发猫叫 + 弹跳动画
   * 使用事件委托 + 500ms 节流 + 尊重静音偏好
   * 仅 .paw-1 / .paw-2 参与（头像旁 .dec-paw 排除）
   */
  function initPawEasterEgg() {
    var lastMeowTime = 0;
    var MEOW_THROTTLE = 500; // ms

    document.addEventListener('click', function (e) {
      var paw = e.target.closest('.paw-1, .paw-2');
      if (!paw) return;

      var now = Date.now();
      if (now - lastMeowTime < MEOW_THROTTLE) return;
      lastMeowTime = now;

      // 播放彩蛋猫叫
      SoundEngine.playMeow();

      // 视觉反馈：弹跳动画
      paw.classList.add('paw-bounce');
      paw.addEventListener('animationend', function handler() {
        paw.classList.remove('paw-bounce');
        paw.removeEventListener('animationend', handler);
      });
    });
  }

  // ==================== 彩蛋① 猫爪五连击（P3） ====================

  /**
   * 头像五连击彩蛋 — 3 秒内连续点击头像 5 次触发粒子爆发 + 喵叫音效
   */
  function initAvatarQuintupleClickEasterEgg() {
    var clickCount = 0;
    var clickTimer = null;
    var CLICK_WINDOW = 3000; // 3s
    var CLICK_TARGET = 5;

    function resetCounter() {
      clickCount = 0;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = null;
    }

    // 事件委托：监听所有 avatar 点击
    document.addEventListener('click', function (e) {
      var avatar = e.target.closest('.avatar');
      if (!avatar) return;

      clickCount++;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(resetCounter, CLICK_WINDOW);

      if (clickCount >= CLICK_TARGET) {
        resetCounter();
        // 触发音效
        SoundEngine.playEasterEggMeow();
        // 视觉反馈：粒子爆发
        triggerAvatarParticleBurst(avatar);
      }
    });
  }

  /**
   * 头像粒子爆发动画
   */
  function triggerAvatarParticleBurst(avatar) {
    // 阶段 1：头像抖动 0.4s
    avatar.classList.add('avatar-shake-easter');
    setTimeout(function () {
      avatar.classList.remove('avatar-shake-easter');
    }, 400);

    var wrapper = avatar.closest('.avatar-wrapper');
    if (!wrapper) return;
    var rect = avatar.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var particleCount = 20;

    for (var i = 0; i < particleCount; i++) {
      var particle = document.createElement('span');
      particle.textContent = Math.random() > 0.4 ? '🐾' : '💛';
      particle.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;' +
        'font-size:' + (16 + Math.random() * 14) + 'px;line-height:1;';
      particle.style.left = cx + 'px';
      particle.style.top = cy + 'px';
      document.body.appendChild(particle);

      var angle = Math.random() * Math.PI * 2;
      var distance = 50 + Math.random() * 80;
      var dx = Math.cos(angle) * distance;
      var dy = Math.sin(angle) * distance;
      var rotation = (Math.random() - 0.5) * 360;

      particle.animate([
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(0) rotate(' + rotation + 'deg)', opacity: 0 }
      ], { duration: 600 + Math.random() * 400, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' })
      .onfinish = function () { particle.remove(); };
    }
  }

  // ==================== 彩蛋② "nya" 暗号（P3） ====================

  /**
   * "nya" 键盘序列彩蛋 — 1.5s 内连续键入 n-y-a 触发铃铛音效
   */
  function initNyaSequenceEasterEgg() {
    var sequence = ['n', 'y', 'a'];
    var seqIndex = 0;
    var seqTimer = null;
    var SEQ_TIMEOUT = 1500;

    document.addEventListener('keydown', function (e) {
      // 忽略在输入框内的输入
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      if (e.key.toLowerCase() === sequence[seqIndex]) {
        seqIndex++;
        if (seqTimer) clearTimeout(seqTimer);
        seqTimer = setTimeout(function () { seqIndex = 0; }, SEQ_TIMEOUT);

        if (seqIndex >= sequence.length) {
          seqIndex = 0;
          if (seqTimer) clearTimeout(seqTimer);
          // 触发魔法铃铛音效
          SoundEngine.playNyaChime();
          // 视觉反馈：页面瞬间柔光闪烁
          triggerNyaFlash();
        }
      } else {
        seqIndex = 0;
      }
    });
  }

  /**
   * "nya" 触发时的完整视觉效果（3.5s 时序）
   */
  function triggerNyaFlash() {
    // 阶段 1：背景滤镜叠加层（CSS 动画自动处理 0.8s 渐入）
    var overlay = document.createElement('div');
    overlay.id = 'nya-overlay';
    document.body.appendChild(overlay);

    // 阶段 2：命运光带加速
    var fateBand = document.querySelector('.fate-light-band');
    if (fateBand) fateBand.classList.add('nya-boost');

    // 阶段 3：文字浮现（0.3s 后）
    var text = document.createElement('div');
    text.id = 'nya-text';
    text.textContent = 'にゃーん ♪';
    document.body.appendChild(text);
    requestAnimationFrame(function () {
      text.classList.add('nya-text-visible');
    });

    // 时序清理（总 3.5s）
    // t=1500ms: 光带恢复
    setTimeout(function () {
      if (fateBand) fateBand.classList.remove('nya-boost');
    }, 1500);

    // t=2000ms: 背景滤镜开始渐出（0.8s）
    setTimeout(function () {
      overlay.style.animation = 'nya-filter-out 0.8s ease forwards';
    }, 2000);

    // t=2800ms: 文字开始渐出
    setTimeout(function () {
      text.classList.remove('nya-text-visible');
    }, 2800);

    // t=3500ms: 清理所有 DOM
    setTimeout(function () {
      if (overlay.parentNode) overlay.remove();
      if (text.parentNode) text.remove();
    }, 3500);
  }

  // ==================== 彩蛋④ BGM 隐藏曲目（P3） ====================

  /**
   * BGM 开关彩蛋 — 3 秒内快速切换 6 次触发隐藏 Lo-Fi 曲目
   */
  function initBgmHiddenTrackEasterEgg() {
    var toggleCount = 0;
    var toggleTimer = null;
    var TOGGLE_WINDOW = 4000; // 规格：4 秒窗口
    var TOGGLE_TARGET = 6;
    var easterEggPlaying = false;

    var bgmToggle = document.getElementById('bgm-toggle');
    if (!bgmToggle) return;

    bgmToggle.addEventListener('click', function () {
      if (easterEggPlaying) return;

      toggleCount++;
      if (toggleTimer) clearTimeout(toggleTimer);
      toggleTimer = setTimeout(function () { toggleCount = 0; }, TOGGLE_WINDOW);

      if (toggleCount >= TOGGLE_TARGET) {
        toggleCount = 0;
        if (toggleTimer) clearTimeout(toggleTimer);
        easterEggPlaying = true;

        // 按钮旋转动画
        bgmToggle.classList.add('egg-spin');
        setTimeout(function () {
          bgmToggle.classList.remove('egg-spin');
        }, 500);

        // 播放隐藏曲目
        BgmEngine.playEasterEggTrack();

        // 视觉反馈 — 使用专用 .egg-toast 样式
        showEggToast('🎹 发现隐藏曲目...', 3000);

        // 15s 后重置（与曲目时长一致）
        setTimeout(function () {
          easterEggPlaying = false;
          var t = document.getElementById('bgm-toggle');
          if (t) updateBgmToggleState(t);
        }, 15500);
      }
    });
  }

  // ==================== 彩蛋⑤ 访客留言瓶（P3） ====================

  /**
   * 留言瓶彩蛋 — Page A 日历中双击空白未来日期弹出留言对话框
   */
  function initMessageBottleEasterEgg() {
    document.addEventListener('dblclick', function (e) {
      var dayBtn = e.target.closest('.calendar-day[data-date]');
      if (!dayBtn) return;

      // 仅 Page A 日历
      var calendarSection = dayBtn.closest('#little-notes-calendar, #thoughts-calendar');
      if (!calendarSection) return;

      var dateStr = dayBtn.getAttribute('data-date');
      var today = new Date();
      var todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
      if (dateStr <= todayStr) return; // 仅未来日期

      // 检查是否有内容（有内容不触发留言瓶）
      if (dayBtn.classList.contains('has-notes')) return;

      // 播放瓶塞音效
      SoundEngine.playBottleOpen();

      // 弹出留言瓶对话框
      showMessageBottleDialog(dateStr, dayBtn);
    });
  }

  /**
   * 留言瓶对话框
   */
  function showMessageBottleDialog(dateStr, dayBtn) {
    // 移除已有对话框
    var existing = document.querySelector('.message-bottle-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'message-bottle-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);' +
      'z-index:10000;display:flex;align-items:center;justify-content:center;' +
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) overlay.remove();
    });

    var dialog = document.createElement('div');
    dialog.className = 'message-bottle-dialog';
    dialog.style.cssText = 'background:var(--glass-bg);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);' +
      'border:1px solid var(--glass-border);border-radius:var(--radius-lg);padding:32px 36px;' +
      'max-width:400px;width:90%;box-shadow:var(--glass-hover-shadow);' +
      'animation:bottleDialogIn 0.5s cubic-bezier(0.23,1,0.32,1);';

    var d = new Date(dateStr + 'T00:00:00');
    var dateDisplay = (d.getMonth() + 1) + '月' + d.getDate() + '日';

    dialog.innerHTML = '<div style="text-align:center;margin-bottom:20px;">' +
      '<span style="font-size:2.5rem;">🍾</span>' +
      '<h3 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin:12px 0 4px;">给 ' + dateDisplay + ' 留言</h3>' +
      '<p style="font-size:0.85rem;color:var(--text-secondary);">写一句话，放进时间漂流瓶里...</p>' +
      '</div>' +
      '<textarea class="bottle-textarea" placeholder="写下你想说的话..." ' +
      'style="width:100%;min-height:100px;border:1px solid var(--glass-border-sub);border-radius:var(--radius-sm);' +
      'padding:14px;font-family:inherit;font-size:0.9rem;resize:vertical;background:rgba(255,255,255,0.5);' +
      'color:var(--text-primary);outline:none;transition:border-color 0.3s;">' +
      '</textarea>' +
      '<div style="display:flex;gap:12px;margin-top:18px;justify-content:flex-end;">' +
      '<button class="bottle-cancel-btn" style="padding:10px 20px;border:1px solid var(--glass-border-sub);' +
      'border-radius:24px;background:transparent;color:var(--text-secondary);cursor:pointer;font-family:inherit;font-size:0.9rem;">取消</button>' +
      '<button class="bottle-submit-btn" style="padding:10px 24px;border:none;border-radius:24px;' +
      'background:var(--gradient-btn);color:var(--text-primary);cursor:pointer;font-family:inherit;' +
      'font-size:0.9rem;font-weight:600;">放入漂流瓶 🎀</button>' +
      '</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 聚焦文本框
    var textarea = dialog.querySelector('.bottle-textarea');
    setTimeout(function () { textarea.focus(); }, 300);

    // 取消按钮
    dialog.querySelector('.bottle-cancel-btn').addEventListener('click', function () {
      overlay.remove();
    });

    // ESC 键关闭
    function onEscKey(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', onEscKey);
      }
    }
    document.addEventListener('keydown', onEscKey);

    // 提交按钮
    dialog.querySelector('.bottle-submit-btn').addEventListener('click', function () {
      var message = textarea.value.trim();
      if (!message) return;
      // 播放确认音效
      SoundEngine.playBottleSubmit();
      // 存储到 localStorage
      saveMessageBottle(dateStr, message);
      // 更新日历格子标记
      if (dayBtn) {
        dayBtn.classList.add('has-bottle');
        dayBtn.classList.add('bottle-flash');
        setTimeout(function () { dayBtn.classList.remove('bottle-flash'); }, 600);
      }
      // 显示成功反馈
      dialog.innerHTML = '<div style="text-align:center;padding:20px 0;">' +
        '<span style="font-size:3rem;">✨</span>' +
        '<h3 style="font-size:1.1rem;margin:12px 0 4px;">漂流瓶已放入大海</h3>' +
        '<p style="font-size:0.85rem;color:var(--text-secondary);">' + dateDisplay + ' 的那天，你会收到这份温柔</p>' +
        '</div>';
      setTimeout(function () { overlay.remove(); }, 2000);
    });
  }

  /**
   * 保存留言瓶到 localStorage
   */
  function saveMessageBottle(dateStr, message) {
    var bottles = [];
    try {
      bottles = JSON.parse(localStorage.getItem('kevi_message_bottles') || '[]');
    } catch (e) {}
    bottles.push({ date: dateStr, message: message, created: Date.now() });
    try {
      localStorage.setItem('kevi_message_bottles', JSON.stringify(bottles));
    } catch (e) {}
  }

  // ==================== 彩蛋⑥ 页脚心形碎裂（P3） ====================

  /**
   * 心形碎裂彩蛋 — Page B 页脚💛 移动端长按 1.5s / 桌面端双击
   */
  function initHeartBurstEasterEgg() {
    var footerHeart = document.querySelector('.footer-heart');
    if (!footerHeart) return;

    var longPressTimer = null;
    var LONG_PRESS_DURATION = 1500;
    var isMobile = window.matchMedia('(pointer: coarse)').matches ||
                   /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    if (isMobile) {
      // 移动端：长按 1.5s
      footerHeart.addEventListener('touchstart', function (e) {
        longPressTimer = setTimeout(function () {
          triggerHeartBurst(footerHeart);
        }, LONG_PRESS_DURATION);
      });
      footerHeart.addEventListener('touchend', function () {
        if (longPressTimer) clearTimeout(longPressTimer);
      });
      footerHeart.addEventListener('touchmove', function () {
        if (longPressTimer) clearTimeout(longPressTimer);
      });
    } else {
      // 桌面端：双击
      footerHeart.addEventListener('dblclick', function (e) {
        e.preventDefault();
        triggerHeartBurst(footerHeart);
      });
    }
  }

  /**
   * 触发心形碎裂动画 + 音效
   */
  var isHeartBursting = false;

  function triggerHeartBurst(heartEl) {
    // 防重复触发
    if (isHeartBursting) return;
    try {
      if (sessionStorage.getItem('kevi_heart_burst_triggered') === '1') return;
      sessionStorage.setItem('kevi_heart_burst_triggered', '1');
    } catch (e) {}
    isHeartBursting = true;

    SoundEngine.playHeartBurst();

    // 阶段 1：心跳放大动画（CSS 动画 0.8s）
    heartEl.classList.add('bursting');

    // 阶段 2：0.8s 后碎片飞散 + 替换文字
    setTimeout(function () {
      var rect = heartEl.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var fragmentCount = 22;

      for (var i = 0; i < fragmentCount; i++) {
        var frag = document.createElement('span');
        frag.textContent = '💛';
        frag.style.cssText = 'position:fixed;pointer-events:none;z-index:10001;' +
          'font-size:' + (12 + Math.random() * 16) + 'px;line-height:1;';
        frag.style.left = cx + 'px';
        frag.style.top = cy + 'px';
        document.body.appendChild(frag);

        var angle = Math.random() * Math.PI * 2;
        var distance = 40 + Math.random() * 80;
        var dx = Math.cos(angle) * distance;
        var dy = Math.sin(angle) * distance - 30;
        var rotation = (Math.random() - 0.5) * 360;
        var isPermanent = i < 6;

        var anim = frag.animate([
          { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
          { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(0) rotate(' + rotation + 'deg)', opacity: 0 }
        ], { duration: 800 + Math.random() * 400, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' });

        if (isPermanent) {
          anim.onfinish = function () {
            addPermanentHeartOnCanvas(cx, cy);
            frag.remove();
          };
        } else {
          anim.onfinish = function () { frag.remove(); };
        }
      }

      // Footer 文字替换
      setTimeout(function () {
        var footerPara = document.querySelector('#page-b .footer p');
        if (!footerPara) {
          footerPara = document.querySelector('.page:not(.hidden) .footer p');
        }
        if (footerPara && footerPara.querySelector('.footer-heart')) {
          footerPara.innerHTML = '© 2026 Kevi_Nya · Made with lots and lots of <span class="footer-heart" style="animation:heart-fade-in 0.5s ease 0.2s both;display:inline-block;">💛💛💛</span> and <span class="coffee">☕</span>';
        }
      }, 200);
    }, 800);

    // 2.2s 后解锁（所有动画结束）
    setTimeout(function () {
      isHeartBursting = false;
    }, 2200);
  }

  /**
   * 在 Canvas 背景添加常驻爱心（本会话有效，由主循环统一绘制）
   */
  function addPermanentHeartOnCanvas(cx, cy) {
    sharedPermanentHearts.push({
      x: cx,
      y: cy,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.2 - Math.random() * 0.3,
      size: 14 + Math.random() * 12,
      alpha: 0.25,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3
    });
  }

  // ==================== 彩蛋③ 午夜花园（P3） ====================

  /**
   * 午夜花园彩蛋 — 每日 22:00–06:00 自动切换夜间氛围
   */
  function initMidnightGardenEasterEgg() {
    var NIGHT_START = 22; // 22:00
    var NIGHT_END = 6;    // 06:00
    var nightActive = false;

    function isNightTime() {
      var hour = new Date().getHours();
      return hour >= NIGHT_START || hour < NIGHT_END;
    }

    function activateNightMode() {
      if (nightActive) return;
      nightActive = true;

      // 创建夜间环境底噪
      SoundEngine.createNightAmbience();

      // 切换 BGM 为夜间变奏
      BgmEngine.setNightMode(true);

      // 视觉：创建夜间蒙层
      var overlay = document.createElement('div');
      overlay.id = 'night-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);

      // 视觉：创建月亮装饰
      var moon = document.createElement('span');
      moon.className = 'moon-decor';
      moon.textContent = '🌙';
      moon.setAttribute('aria-hidden', 'true');
      var decorations = document.querySelector('.bg-decorations');
      if (decorations) decorations.appendChild(moon);

      // 整体色调标记
      document.body.classList.add('night-mode');

      // 启动萤火虫粒子
      startFireflyParticles();
    }

    function deactivateNightMode() {
      if (!nightActive) return;
      nightActive = false;

      // 销毁夜间环境底噪
      SoundEngine.destroyNightAmbience();

      // 恢复 BGM
      BgmEngine.setNightMode(false);

      // 清理视觉元素
      var overlay = document.getElementById('night-overlay');
      if (overlay) overlay.remove();

      var moon = document.querySelector('.moon-decor');
      if (moon) moon.remove();

      document.body.classList.remove('night-mode');

      // 停止萤火虫粒子
      stopFireflyParticles();
    }

    // ===== 萤火虫粒子系统（数据由主循环统一绘制，无独立 rAF） =====

    function startFireflyParticles() {
      var canvas = document.getElementById('bg-canvas');
      if (!canvas) return;

      var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      var isReducedMotion = motionQuery.matches;
      var count = isReducedMotion ? 4 : 12;

      sharedFireflies = [];
      for (var i = 0; i < count; i++) {
        sharedFireflies.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3 - 0.2,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: isReducedMotion ? 0 : (0.01 + Math.random() * 0.02)
        });
      }

      sharedFirefliesActive = true;
    }

    function stopFireflyParticles() {
      sharedFirefliesActive = false;
      sharedFireflies = [];
    }

    // 初始检测
    if (isNightTime()) {
      // 延迟执行，等待 BGM 初始化
      setTimeout(function () {
        activateNightMode();
      }, 2000);
    }

    // 定时检查（每 5 分钟）
    setInterval(function () {
      if (isNightTime()) {
        activateNightMode();
      } else {
        deactivateNightMode();
      }
    }, 300000);

    // 页面可见性变化时重新检测（用户从其他标签页切回）
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        if (isNightTime()) {
          activateNightMode();
        } else {
          deactivateNightMode();
        }
      }
    });
  }

  // ==================== 花园时钟 ====================

  function initGardenClock() {
    var hourGroup   = document.getElementById('clock-hour-group');
    var minuteGroup = document.getElementById('clock-minute-group');
    var secondGroup = document.getElementById('clock-second-group');
    if (!hourGroup || !minuteGroup || !secondGroup) return;

    function tick() {
      var now = new Date();
      var hours = now.getHours() % 12;
      var minutes = now.getMinutes();
      var seconds = now.getSeconds();
      var ms = now.getMilliseconds();

      var secondAngle = (seconds + ms / 1000) * 6;
      var minuteAngle = (minutes + seconds / 60) * 6;
      var hourAngle   = (hours + minutes / 60) * 30;

      secondGroup.setAttribute('transform', 'rotate(' + secondAngle + ', 54, 54)');
      minuteGroup.setAttribute('transform', 'rotate(' + minuteAngle + ', 54, 54)');
      hourGroup.setAttribute('transform',   'rotate(' + hourAngle   + ', 54, 54)');

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  // ==================== 花园时钟 点击交互（v2） ====================

  var clockTapCooldown = false;

  /**
   * 时间粒子渐变配色 — 基于归一化 Y 坐标色阶插值
   * @param {number} normY - 归一化 Y 坐标 0(顶部粉色) ~ 1(底部紫色)
   * @returns {string} rgb(r, g, b)
   */
  function getTimeParticleColor(normY) {
    normY = Math.max(0, Math.min(1, normY));

    var stops = [
      { pos: 0.00, r: 0xFF, g: 0x7B, b: 0x9C },
      { pos: 0.33, r: 0xF0, g: 0xB8, b: 0xD0 },
      { pos: 0.67, r: 0xD5, g: 0xA0, b: 0xE0 },
      { pos: 1.00, r: 0xB5, g: 0x80, b: 0xD5 }
    ];

    var lower = stops[0], upper = stops[stops.length - 1];
    for (var i = 0; i < stops.length - 1; i++) {
      if (normY >= stops[i].pos && normY <= stops[i + 1].pos) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }

    var range = upper.pos - lower.pos;
    var t = range === 0 ? 0 : (normY - lower.pos) / range;
    var r = Math.round(lower.r + (upper.r - lower.r) * t);
    var g = Math.round(lower.g + (upper.g - lower.g) * t);
    var b = Math.round(lower.b + (upper.b - lower.b) * t);

    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /**
   * 离屏渲染时间字符串 + 像素采样
   * @returns {{ points: Array<{x: number, y: number}>, timeStr: string }}
   */
  function sampleTimeDigits() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var timeStr = h + ':' + m;

    var offCanvas = document.createElement('canvas');
    offCanvas.width = 300;
    offCanvas.height = 80;
    var offCtx = offCanvas.getContext('2d');
    offCtx.font = '700 72px "Kalam", "Patrick Hand", cursive, sans-serif';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.lineWidth = 4;
    offCtx.strokeStyle = '#FFFFFF';
    offCtx.strokeText(timeStr, 150, 40);

    var imageData = offCtx.getImageData(0, 0, 300, 80);
    var pixels = imageData.data;
    var step = 2;
    var points = [];

    for (var y = 0; y < 80; y += step) {
      for (var x = 0; x < 300; x += step) {
        var idx = (y * 300 + x) * 4;
        if (pixels[idx + 3] > 128) {
          points.push({ x: x, y: y });
        }
      }
    }
    return { points: points, timeStr: timeStr };
  }

  /**
   * 从时间数字像素点创建粒子
   * @param {number} clockCenterX - 钟面中心 X（视口坐标）
   * @param {number} clockCenterY - 钟面中心 Y（视口坐标）
   * @param {number} viewportW - 视口宽度
   * @param {number} viewportH - 视口高度
   */
  function spawnTimeParticles(clockCenterX, clockCenterY, viewportW, viewportH) {
    var result = sampleTimeDigits();
    var points = result.points;

    var digitW = 300, digitH = 80;
    var scale = Math.min(viewportW / digitW * 0.85, viewportH / digitH * 0.5);
    var displayW = digitW * scale;
    var displayH = digitH * scale;
    var offsetX = (viewportW - displayW) / 2;
    var offsetY = viewportH * 0.35 - displayH / 2;
    var digitTop = offsetY;
    var digitBottom = offsetY + displayH;

    for (var i = 0; i < points.length; i++) {
      var targetX = offsetX + points[i].x * scale;
      var targetY = offsetY + points[i].y * scale;

      // 基于 Y 坐标计算渐变颜色
      var normY = (targetY - digitTop) / (digitBottom - digitTop);
      var particleColor = getTimeParticleColor(normY);

      var angle = Math.random() * Math.PI * 2;
      var dist = 20 + Math.random() * 60;
      var startX = clockCenterX + Math.cos(angle) * dist;
      var startY = clockCenterY + Math.sin(angle) * dist;

      timeParticles.push({
        x: startX, y: startY,
        startX: startX, startY: startY,
        targetX: targetX, targetY: targetY,
        state: 'forming',
        size: 2 + Math.random() * 1.5,
        color: particleColor,
        alpha: 0,
        formDuration: 0.50 + Math.random() * 0.15
      });
    }
  }

  /**
   * 上行琶音音效 C6→E6→G6
   */
  function playClockChime() {
    var ctx = SoundEngine.getContext();
    if (!ctx || SoundEngine.isMuted()) return;
    var now = ctx.currentTime;
    var notes = [
      { freq: 1047, time: 0,    gain: 0.25 },
      { freq: 1319, time: 0.10, gain: 0.22 },
      { freq: 1568, time: 0.20, gain: 0.20 }
    ];
    notes.forEach(function (n) {
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, now + n.time);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + n.time);
      gain.gain.linearRampToValueAtTime(n.gain, now + n.time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.time);
      osc.stop(now + n.time + 0.40);
    });
  }

  /**
   * 花园时钟点击事件主逻辑
   */
  function initClockTap() {
    var clock = document.querySelector('.garden-clock');
    if (!clock) return;

    clock.addEventListener('click', function (e) {
      if (clockTapCooldown) return;

      // 首次点击时等待 Kalam 字体加载完成
      if (document.fonts && !document.fonts.check('700 72px Kalam')) {
        document.fonts.ready.then(function () {
          clock.dispatchEvent(new MouseEvent('click', { clientX: e.clientX, clientY: e.clientY }));
        });
        return;
      }

      clockTapCooldown = true;

      // === 机械层 ===

      // 容器脉冲
      clock.classList.add('tap-active');
      setTimeout(function () { clock.classList.remove('tap-active'); }, 500);

      // 辉光环
      var ring = document.getElementById('clock-ring-glow');
      if (ring) { ring.classList.add('ring-flash'); setTimeout(function () { ring.classList.remove('ring-flash'); }, 600); }

      // 表冠旋弹
      var crown = document.getElementById('clock-crown');
      if (crown) { crown.classList.add('crown-flick'); setTimeout(function () { crown.classList.remove('crown-flick'); }, 450); }

      // 音效
      playClockChime();

      // 齿轮星芒逐点闪烁
      var gears = document.querySelectorAll('.clock-gear-pink');
      for (var g = 0; g < gears.length; g++) {
        (function (el, d) {
          setTimeout(function () { el.classList.add('gear-flash'); setTimeout(function () { el.classList.remove('gear-flash'); }, 600); }, d);
        })(gears[g], g * 70);
      }

      // 链节摆动
      ['clock-chain-1', 'clock-chain-2', 'clock-chain-3'].forEach(function (id, i) {
        setTimeout(function () {
          var el = document.getElementById(id);
          if (el) { el.classList.add('chain-sway'); setTimeout(function () { el.classList.remove('chain-sway'); }, 500); }
        }, 50 + i * 50);
      });

      // === Canvas 层：时间数字粒子 ===

      // 清除上一轮
      timeParticles = [];
      timeParticleElapsed = 0;
      timeParticleLastTs = 0;

      // 创建新粒子
      var clockRect = clock.getBoundingClientRect();
      var clockCX = clockRect.left + 54;
      var clockCY = clockRect.top + 54;
      spawnTimeParticles(clockCX, clockCY, window.innerWidth, window.innerHeight);

      // === 冷却 3.0s ===
      setTimeout(function () {
        clockTapCooldown = false;
      }, 3000);
    });
  }

  /**
   * 独立时间粒子渲染（使用 overlay Canvas，脱离主粒子循环）
   */
  function renderTimeParticles() {
    var canvas = document.getElementById('time-particle-overlay');
    if (!canvas || timeParticles.length === 0) {
      if (canvas) canvas.style.display = 'none';
      return;
    }
    canvas.style.display = 'block';
    var ctx = timeParticleOverlayCtx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var nowTs = performance.now();
    if (timeParticleLastTs === 0) timeParticleLastTs = nowTs;
    var dt = Math.min((nowTs - timeParticleLastTs) / 1000, 0.05);
    timeParticleLastTs = nowTs;
    timeParticleElapsed += dt;

    // === holding 阶段底衬（亮色辉光 / 暗色压暗双模式） ===
    if (timeParticleElapsed >= 0.3 && timeParticleElapsed < 1.8) {
      var isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

      // 渐入/保持/渐出 alpha（ease-out / ease-in 曲线）
      var bgAlpha;
      if (timeParticleElapsed < 0.8) {
        // 渐入 0.5s（0.3→0.8）：ease-out
        var tIn = (timeParticleElapsed - 0.3) / 0.5;
        bgAlpha = 1 - Math.pow(Math.max(0, 1 - tIn), 2);
      } else if (timeParticleElapsed < 1.3) {
        // 保持峰值
        bgAlpha = 1.0;
      } else {
        // 渐出 0.5s（1.3→1.8）：ease-in
        var tOut = (timeParticleElapsed - 1.3) / 0.5;
        bgAlpha = 1 - Math.pow(Math.min(1, tOut), 2);
      }
      bgAlpha = Math.max(0, Math.min(1, bgAlpha));

      if (isDarkMode) {
        // 暗色模式：暗底衬，让亮粒子更突出
        if (!timeParticleOverlayCtx._bgGradient) {
          var grad = ctx.createRadialGradient(
            canvas.width / 2, canvas.height * 0.35, canvas.width * 0.1,
            canvas.width / 2, canvas.height * 0.35, canvas.width * 0.6
          );
          grad.addColorStop(0, 'rgba(26, 21, 32, 0)');
          grad.addColorStop(1, 'rgba(26, 21, 32, 1)');
          timeParticleOverlayCtx._bgGradient = grad;
        }
        ctx.globalAlpha = bgAlpha * 0.08;
        ctx.fillStyle = timeParticleOverlayCtx._bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      } else {
        // 亮色模式：柔白辉光底衬，让粒子浮在光晕上
        if (!timeParticleOverlayCtx._bgGradient) {
          var grad = ctx.createRadialGradient(
            canvas.width / 2, canvas.height * 0.35, canvas.width * 0.05,
            canvas.width / 2, canvas.height * 0.35, canvas.width * 0.45
          );
          grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
          grad.addColorStop(1, 'rgba(255, 248, 240, 0)');
          timeParticleOverlayCtx._bgGradient = grad;
        }
        ctx.globalAlpha = bgAlpha * 0.25;
        ctx.fillStyle = timeParticleOverlayCtx._bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
    }

    // === 粒子运动 ===
    for (var p = timeParticles.length - 1; p >= 0; p--) {
      var tp = timeParticles[p];

      if (tp.state === 'forming') {
        var progress = Math.min(timeParticleElapsed / (tp.formDuration || 0.6), 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        tp.x = tp.startX + (tp.targetX - tp.startX) * eased;
        tp.y = tp.startY + (tp.targetY - tp.startY) * eased;
        tp.alpha = eased * 0.95;
        if (progress >= 1) tp.state = 'holding';
      } else if (tp.state === 'holding') {
        tp.x = tp.targetX;
        tp.y = tp.targetY;
        tp.alpha = 0.9 + Math.sin(timeParticleElapsed * 4 + p * 0.3) * 0.1;
        if (timeParticleElapsed >= 1.3) {
          // 进入消散：初始化风晶蝶式漂浮参数
          if (!tp.driftAngle) {
            tp.driftAngle = Math.random() * Math.PI * 2;
            tp.driftSpeed = 10 + Math.random() * 25;
            tp.wobblePhase = Math.random() * Math.PI * 2;
            tp.wobbleAmp = 0.4 + Math.random() * 0.8;
            tp.wobbleFreq = 1.5 + Math.random() * 2.0;
          }
          tp.state = 'dissipating';
        }
      } else if (tp.state === 'dissipating') {
        var dProgress = Math.min((timeParticleElapsed - 1.3) / 1.5, 1);

        // 主方向漂移
        tp.x += Math.cos(tp.driftAngle) * tp.driftSpeed * dt;
        tp.y += Math.sin(tp.driftAngle) * tp.driftSpeed * dt;

        // 风晶蝶式正弦浮游
        var wobbleOffset = Math.sin(timeParticleElapsed * tp.wobbleFreq * Math.PI + tp.wobblePhase) * tp.wobbleAmp;
        tp.x += Math.cos(tp.driftAngle + Math.PI / 2) * wobbleOffset * dt * 2;
        tp.y += Math.sin(tp.driftAngle + Math.PI / 2) * wobbleOffset * dt * 2;

        // 慢速淡出（二次曲线）
        tp.alpha = Math.max(0, 1 - dProgress * dProgress);

        if (timeParticleElapsed >= 2.8) {
          timeParticles.splice(p, 1);
          continue;
        }
      }

      // === 绘制（含增强辉光） ===
      var sz, glowRadius, glowAlpha;
      if (tp.state === 'holding') {
        sz = tp.size + 0.5;
        glowRadius = sz * 1.6;
        glowAlpha = 0.28;
      } else if (tp.state === 'dissipating') {
        var shrink = 1 - Math.min((timeParticleElapsed - 1.3) / 1.5, 1);
        sz = tp.size * Math.max(0, 0.8 * shrink + 0.2);
        glowRadius = sz * 1.5;
        glowAlpha = 0.15;
      } else {
        sz = tp.size;
        glowRadius = sz * 2.5;
        glowAlpha = 0.20;
      }

      ctx.save();
      ctx.globalAlpha = tp.alpha;
      ctx.fillStyle = tp.color;

      // 辉光
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, glowRadius, 0, Math.PI * 2);
      ctx.globalAlpha = tp.alpha * glowAlpha;
      ctx.fill();

      // 核心
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, sz, 0, Math.PI * 2);
      ctx.globalAlpha = tp.alpha;
      ctx.fill();

      ctx.restore();
    }

    // 全部消散完毕
    if (timeParticles.length === 0) {
      timeParticleElapsed = 0;
      timeParticleLastTs = 0;
      canvas.style.display = 'none';
      timeParticleOverlayCtx._bgGradient = null;
    }
  }

  // ==================== 初始化 ====================

  /**
   * 初始化分享模块
   * 微信/QQ/微博/X 分享 + 移动端 Web Share API
   */
  function initShareModule() {
    var siteUrl = 'https://kevi-nya.github.io';
    var siteTitle = 'Kevi_Nya — 猫耳少年的数字花园';
    var siteDesc = '用代码记录想法，用镜头记录世界。属于 kevi_nya 的温柔、治愈、有猫系灵魂的个人数字花园。';
    var ogImage = 'https://kevi-nya.github.io/pics/og-image.jpg';

    // 微信二维码
    var wechatBtn = document.querySelectorAll('.share-btn')[0];
    if (wechatBtn) {
      wechatBtn.addEventListener('click', function () {
        showWechatQR(siteUrl);
      });
    }

    // QQ
    var qqBtn = document.querySelectorAll('.share-btn')[1];
    if (qqBtn) {
      qqBtn.addEventListener('click', function () {
        var qqUrl = 'https://connect.qq.com/widget/shareqq/index.html?url=' +
          encodeURIComponent(siteUrl) + '&title=' + encodeURIComponent(siteTitle) +
          '&desc=' + encodeURIComponent(siteDesc) + '&site=Kevi_Nya';
        window.open(qqUrl, '_blank', 'width=600,height=500');
      });
    }

    // 微博
    var weiboBtn = document.querySelectorAll('.share-btn')[2];
    if (weiboBtn) {
      weiboBtn.addEventListener('click', function () {
        var weiboUrl = 'https://service.weibo.com/share/share.php?url=' +
          encodeURIComponent(siteUrl) + '&title=' + encodeURIComponent(siteTitle) +
          '&pic=' + encodeURIComponent(ogImage);
        window.open(weiboUrl, '_blank', 'width=600,height=500');
      });
    }

    // X (Twitter)
    var xBtn = document.querySelectorAll('.share-btn')[3];
    if (xBtn) {
      xBtn.addEventListener('click', function () {
        var xUrl = 'https://twitter.com/intent/tweet?url=' +
          encodeURIComponent(siteUrl) + '&text=' + encodeURIComponent(siteTitle);
        window.open(xUrl, '_blank', 'width=600,height=400');
      });
    }

    // 移动端 Web Share API
    if (navigator.share && window.innerWidth < 768) {
      var allBtns = document.querySelectorAll('.share-btn');
      allBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          navigator.share({ url: siteUrl, title: siteTitle, text: siteDesc }).catch(function () {});
        });
      });
    }
  }

  /**
   * 显示微信扫码分享二维码弹窗
   * @param {string} url - 要分享的 URL
   */
  function showWechatQR(url) {
    // 检查是否已有弹窗
    var existing = document.querySelector('.share-qr-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'share-qr-overlay';
    overlay.innerHTML = '<div class="share-qr-dialog">' +
      '<h3>微信扫码分享</h3>' +
      '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' +
      encodeURIComponent(url) + '" width="200" height="200" alt="QR Code" style="display:block;margin:0 auto;">' +
      '<p class="share-qr-tip">打开微信「扫一扫」分享给朋友</p>' +
      '<button class="share-qr-close">关闭</button>' +
      '</div>';

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector('.share-qr-close').addEventListener('click', function () {
      overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  function init() {
    // 先加载数据并渲染，再初始化页面路由和动画
    loadData().then(function (data) {
      renderDynamicContent(data);

      // 初始化分享模块（Page B Links 卡片内的分享按钮）
      initShareModule();

      initPageRouting();
      initAvatarEffect();
      initAvatarRing();
      initClickRipple();
      initSoundHooks();
      initSoundToggle();
      initBgmToggle();
      initPawEasterEgg();
      initBackgroundParallax();
      initBackgroundParticles();

      // 彩蛋系统（P3 — 六彩蛋交互）
      initAvatarQuintupleClickEasterEgg();
      initNyaSequenceEasterEgg();
      initBgmHiddenTrackEasterEgg();
      initMessageBottleEasterEgg();
      initHeartBurstEasterEgg();
      initMidnightGardenEasterEgg();

      // 首屏 cinematic 加载序列 — 在所有模块初始化后启动
      initCinematicIntro().then(function () {
        // 始终初始化滚动动画，确保任何跳过路径下元素均可正常显示
        initScrollAnimation();

        // 音效首次使用提示 — 延迟 1.5s 后显示，4s 后淡出
        showSoundHint();

        // 预加载时钟点击用 Kalam 字体（不阻塞页面）
        if (document.fonts) {
          document.fonts.load('700 72px Kalam').catch(function () {});
        }

        // 启动花园时钟
        initGardenClock();

        // 花园时钟点击交互
        initClockTap();

        // 初始化时间粒子覆盖层 Canvas
        var overlayCanvas = document.getElementById('time-particle-overlay');
        if (overlayCanvas) {
          overlayCanvas.width = window.innerWidth;
          overlayCanvas.height = window.innerHeight;
          timeParticleOverlayCtx = overlayCanvas.getContext('2d');
        }
      });

      // 音效引擎延迟初始化：遵守浏览器自动播放策略，
      // 在首次用户手势（点击/触摸/键盘）后才创建 AudioContext
      function initAudioOnFirstGesture() {
        SoundEngine.init();
        BgmEngine.init();
        // 首次手势后自动开始播放 BGM（用户可随时通过按钮关闭）
        if (!BgmEngine.isMuted()) {
          var page = (pageA && !pageA.classList.contains('hidden')) ? 'a' : 'b';
          BgmEngine.play(page);
          var bgmToggle = document.getElementById('bgm-toggle');
          if (bgmToggle) updateBgmToggleState(bgmToggle);
        }
        document.removeEventListener('click', initAudioOnFirstGesture);
        document.removeEventListener('touchstart', initAudioOnFirstGesture);
        document.removeEventListener('keydown', initAudioOnFirstGesture);
      }
      document.addEventListener('click', initAudioOnFirstGesture);
      document.addEventListener('touchstart', initAudioOnFirstGesture);
      document.addEventListener('keydown', initAudioOnFirstGesture);

      // 全局 QQ 号复制交互 — 事件委托，覆盖 Page A（静态）和 Page B（动态）的 [data-qq] 链接
      document.addEventListener('click', function (e) {
        var qqLink = e.target.closest('[data-qq]');
        if (!qqLink) return;
        e.preventDefault();
        var qqNumber = qqLink.getAttribute('data-qq');
        copyToClipboard(qqNumber);
        showToast('QQ 号 ' + qqNumber + ' 已复制到剪贴板 ✨');
        SoundEngine.playClick();
      });
    });

    // 注册 Service Worker — 自动缓存管理
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function (reg) {
        // 监听更新：新 SW 已安装但等待激活时触发
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', function () {
            // 新版 SW 激活完成 → 页面已有新缓存
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              // 静默更新：不弹窗打扰，仅 console 记录
              console.log('[花园] 缓存已自动更新');
            }
          });
        });
      }).catch(function (err) {
        console.warn('[花园] Service Worker 注册失败:', err);
      });
    }
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
