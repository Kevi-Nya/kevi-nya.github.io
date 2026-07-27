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
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
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

  // ==================== 动态数据加载与渲染 ====================

  /**
   * 从 data.json 加载内容数据
   * @returns {Promise<Object>} 包含 about_tags, life_cards, little_notes 的数据对象
   */
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

  /**
   * 渲染 Little Notes 短文字卡片
   * @param {Array} notes - 笔记数组 [{content, note_date}, ...]
   */
  function renderLittleNotes(notes) {
    var container = document.getElementById('notes-container');
    if (!container) return;

    var html = '';
    notes.forEach(function (note) {
      html +=
        '<div class="note-card">' +
        '<p>' + note.content + '</p>' +
        '<span class="note-date">' + note.note_date + '</span>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  /**
   * 使用数据渲染所有动态区域
   * @param {Object} data - 从 data.json 加载的数据
   */
  function renderDynamicContent(data) {
    if (data.about_tags) renderAboutTags(data.about_tags);
    if (data.life_cards) renderLifeCards(data.life_cards);
    if (data.little_notes) renderLittleNotes(data.little_notes);
    if (data.thoughts) renderThoughts(data.thoughts);
    if (data.skills) renderSkills(data.skills);
    if (data.links) renderLinks(data.links);
  }

  /**
   * 渲染 Thoughts 思考/随笔
   * @param {Array} thoughts - [{tag_type, tag_label, title, summary, thought_date}, ...]
   */
  function renderThoughts(thoughts) {
    var container = document.getElementById('thoughts-container');
    if (!container) return;

    var html = '';
    thoughts.forEach(function (item) {
      html +=
        '<div class="thought-item">' +
        '<div class="thought-tag tag-' + item.tag_type + '">' + item.tag_label + '</div>' +
        '<h3>' + item.title + '</h3>' +
        '<p>' + item.summary + '</p>' +
        '<span class="thought-date">' + item.thought_date + '</span>' +
        '</div>';
    });
    container.innerHTML = html;
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
    });
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
