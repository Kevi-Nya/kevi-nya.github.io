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
          if (entry.tags && entry.tags.length > 0) {
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
          html += '<div class="note-detail-tags">';
          if (entry.tag_label) {
            var tagClass = entry.tag_type ? 'tag-' + entry.tag_type : 'tag-default';
            html += '<span class="note-detail-tag ' + tagClass + '">' + entry.tag_label + '</span>';
          }
          if (entry.tags && entry.tags.length > 0) {
            entry.tags.forEach(function (tag) {
              if (tag !== entry.tag_label) {
                html += '<span class="note-detail-tag">' + tag + '</span>';
              }
            });
          }
          html += '</div>';
        }

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
