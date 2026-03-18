(function () {
  const doc = document.documentElement;
  const body = document.body;
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const themeLabels = {
    dark: body?.dataset?.uiThemeDark || 'Switch to dark mode',
    light: body?.dataset?.uiThemeLight || 'Switch to light mode'
  };

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function setTheme(nextTheme) {
    doc.classList.toggle('dark', nextTheme === 'dark');
    doc.dataset.theme = nextTheme;
    document.querySelectorAll('[data-theme-next]').forEach((input) => {
      input.value = nextTheme === 'dark' ? 'light' : 'dark';
    });
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-label', nextTheme === 'dark' ? themeLabels.light : themeLabels.dark);
      button.setAttribute('aria-pressed', String(nextTheme === 'dark'));
    });
  }

  async function persistTheme(nextTheme) {
    try {
      localStorage.setItem('whale-theme', nextTheme);
      sessionStorage.setItem('whale-theme', nextTheme);
    } catch (_error) {
      // ignore storage failures
    }

    try {
      await fetch('/prefs/theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: `_csrf=${encodeURIComponent(csrf)}&theme=${encodeURIComponent(nextTheme)}`
      });
    } catch (_error) {
      // session sync failure should not block the UI state change
    }
  }

  document.querySelectorAll('[data-theme-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nextThemeInput = form.querySelector('[data-theme-next]');
      const nextTheme = nextThemeInput?.value === 'dark' ? 'dark' : 'light';

      if (!reducedMotion && document.startViewTransition) {
        body.classList.add('whale-theme-transitioning');
        await document.startViewTransition(async () => {
          setTheme(nextTheme);
          await nextFrame();
        }).finished.catch(() => {});
        window.setTimeout(() => body.classList.remove('whale-theme-transitioning'), 350);
      } else {
        body.classList.add('whale-theme-transitioning');
        setTheme(nextTheme);
        window.setTimeout(() => body.classList.remove('whale-theme-transitioning'), 350);
      }

      await persistTheme(nextTheme);
    });
  });

  const notificationShells = Array.from(document.querySelectorAll('.nav-notification-shell'));
  notificationShells.forEach((shell) => {
    const trigger = shell.querySelector('[data-notification-toggle]');
    const panel = shell.querySelector('[data-notification-panel]');
    if (!trigger || !panel) return;

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = shell.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(isOpen));
    });
  });
  document.addEventListener('click', (event) => {
    notificationShells.forEach((shell) => {
      if (shell.contains(event.target)) return;
      shell.classList.remove('is-open');
      shell.querySelector('[data-notification-toggle]')?.setAttribute('aria-expanded', 'false');
    });
  });

  const filterOpeners = Array.from(document.querySelectorAll('.whale-filters-open'));
  const filterDrawer = document.querySelector('.whale-filter-drawer');
  const filterClosers = Array.from(document.querySelectorAll('[data-filter-close]'));
  if (filterDrawer && filterOpeners.length) {
    const filterSheet = filterDrawer.querySelector('.whale-filter-card');
    let sheetStartY = 0;
    let sheetDragging = false;

    const closeFilterDrawer = () => {
      body.classList.remove('whale-filters-visible');
      if (filterSheet) filterSheet.style.removeProperty('transform');
    };
    filterOpeners.forEach((button) => {
      button.addEventListener('click', () => body.classList.add('whale-filters-visible'));
    });
    filterClosers.forEach((button) => {
      button.addEventListener('click', closeFilterDrawer);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeFilterDrawer();
    });

    if (filterSheet) {
      filterSheet.addEventListener('touchstart', (event) => {
        if (!body.classList.contains('whale-filters-visible')) return;
        sheetStartY = event.touches[0]?.clientY || 0;
        sheetDragging = filterSheet.scrollTop <= 0;
      }, { passive: true });

      filterSheet.addEventListener('touchmove', (event) => {
        if (!sheetDragging) return;
        const currentY = event.touches[0]?.clientY || 0;
        const distance = Math.max(0, currentY - sheetStartY);
        filterSheet.style.transform = `translateY(${distance}px)`;
      }, { passive: true });

      filterSheet.addEventListener('touchend', () => {
        if (!sheetDragging) return;
        const transform = filterSheet.style.transform || '';
        const matched = transform.match(/translateY\((\d+)px\)/);
        const distance = matched ? Number(matched[1]) : 0;
        if (distance > 96) {
          closeFilterDrawer();
        } else {
          filterSheet.style.removeProperty('transform');
        }
        sheetDragging = false;
      }, { passive: true });
    }
  }

  const filterForms = Array.from(document.querySelectorAll('[data-market-filters]'));
  filterForms.forEach((form) => {
    let submitTimer = null;

    function autoSubmit() {
      if (!window.matchMedia('(min-width: 960px)').matches) return;
      window.clearTimeout(submitTimer);
      submitTimer = window.setTimeout(() => {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.submit();
      }, 160);
    }

    form.querySelectorAll('input[type="radio"], input[type="range"], input[type="number"], select').forEach((field) => {
      field.addEventListener('change', autoSubmit);
    });
  });

  document.querySelectorAll('[data-range-cluster]').forEach((cluster) => {
    const minValue = Number(cluster.dataset.min || 0);
    const maxValue = Number(cluster.dataset.max || 100);
    const minRange = cluster.querySelector('[data-range-input="min"]');
    const maxRange = cluster.querySelector('[data-range-input="max"]');
    const minNumber = cluster.querySelector('[data-range-number="min"]');
    const maxNumber = cluster.querySelector('[data-range-number="max"]');
    const progress = cluster.querySelector('[data-range-progress]');

    if (!minRange || !maxRange || !minNumber || !maxNumber || !progress) return;

    function clampValues(source) {
      let nextMin = Number(minRange.value || minValue);
      let nextMax = Number(maxRange.value || maxValue);

      if (source === 'min-number') nextMin = Number(minNumber.value || minValue);
      if (source === 'max-number') nextMax = Number(maxNumber.value || maxValue);

      nextMin = Math.max(minValue, Math.min(nextMin, maxValue));
      nextMax = Math.max(minValue, Math.min(nextMax, maxValue));

      if (nextMin > nextMax) {
        if (source === 'min-range' || source === 'min-number') nextMax = nextMin;
        else nextMin = nextMax;
      }

      minRange.value = String(nextMin);
      maxRange.value = String(nextMax);
      minNumber.value = nextMin === minValue ? '' : String(nextMin);
      maxNumber.value = nextMax === maxValue ? '' : String(nextMax);

      const start = ((nextMin - minValue) / Math.max(1, maxValue - minValue)) * 100;
      const end = ((nextMax - minValue) / Math.max(1, maxValue - minValue)) * 100;
      progress.style.setProperty('--range-start', `${start}%`);
      progress.style.setProperty('--range-end', `${end}%`);
    }

    clampValues();

    minRange.addEventListener('input', () => clampValues('min-range'));
    maxRange.addEventListener('input', () => clampValues('max-range'));
    minNumber.addEventListener('input', () => clampValues('min-number'));
    maxNumber.addEventListener('input', () => clampValues('max-number'));
  });

  const counterObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const target = Number(entry.target.dataset.counter || 0);
        const duration = reducedMotion ? 0 : 1000;
        const start = performance.now();

        function tick(now) {
          const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
          const value = Math.round(target * (1 - Math.pow(1 - progress, 3)));
          entry.target.textContent = value.toLocaleString(doc.lang === 'ar' ? 'ar-PS' : 'en-US');
          if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      });
    }, { threshold: 0.35 })
    : null;

  document.querySelectorAll('[data-counter]').forEach((node) => {
    if (counterObserver) counterObserver.observe(node);
    else node.textContent = Number(node.dataset.counter || 0).toLocaleString(doc.lang === 'ar' ? 'ar-PS' : 'en-US');
  });

  const toastWrap = document.getElementById('toast-wrap');
  const toastQueue = [];
  const activeToasts = new Set();

  function removeToast(node) {
    if (!node || !activeToasts.has(node)) return;
    node.classList.add('is-leaving');
    activeToasts.delete(node);
    window.setTimeout(() => {
      node.remove();
      flushToastQueue();
    }, reducedMotion ? 10 : 260);
  }

  function buildToast(message, type, duration) {
    const node = document.createElement('article');
    const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    node.className = `whale-toast is-${safeType}`;
    node.setAttribute('role', 'status');
    node.innerHTML = `
      <div class="whale-toast-body">
        <div class="whale-toast-copy">${message}</div>
        <button type="button" class="whale-toast-close" aria-label="${body?.dataset?.uiClose || 'Close'}">✕</button>
      </div>
      <div class="whale-toast-progress"><span></span></div>
    `;

    const bar = node.querySelector('.whale-toast-progress span');
    const closeButton = node.querySelector('.whale-toast-close');
    const timeout = window.setTimeout(() => removeToast(node), duration);
    activeToasts.add(node);

    closeButton?.addEventListener('click', () => {
      window.clearTimeout(timeout);
      removeToast(node);
    });

    if (bar) {
      bar.style.animationDuration = `${duration}ms`;
    }

    let startX = 0;
    node.addEventListener('touchstart', (event) => {
      startX = event.changedTouches[0]?.clientX || 0;
    }, { passive: true });
    node.addEventListener('touchend', (event) => {
      const endX = event.changedTouches[0]?.clientX || 0;
      if (Math.abs(endX - startX) > 72) {
        window.clearTimeout(timeout);
        removeToast(node);
      }
    }, { passive: true });

    return node;
  }

  function flushToastQueue() {
    if (!toastWrap) return;
    while (toastQueue.length && activeToasts.size < 3) {
      const next = toastQueue.shift();
      const node = buildToast(next.message, next.type, next.duration);
      toastWrap.appendChild(node);
    }
  }

  window.showToast = function showToast(message, type, duration) {
    if (!toastWrap || !message) return;
    toastQueue.push({
      message: String(message),
      type: type || 'info',
      duration: Number(duration) || 4200
    });
    flushToastQueue();
  };

  const mobileNavLinks = document.querySelectorAll('.mobile-nav .mob-link');
  mobileNavLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (!('vibrate' in navigator)) return;
      navigator.vibrate(8);
    });
  });

  const marketPage = document.querySelector('.whale-marketplace-page');
  if (marketPage && 'ontouchstart' in window && window.matchMedia('(max-width: 959px)').matches) {
    const loadingLabel = body?.dataset?.uiLoading || (doc.lang === 'ar' ? 'جاري التحميل...' : 'Loading...');
    const indicator = document.createElement('div');
    indicator.className = 'whale-pull-indicator';
    indicator.hidden = true;
    indicator.setAttribute('aria-hidden', 'true');
    indicator.innerHTML = `<span class="whale-pull-logo">🐳</span><span class="whale-pull-text">${loadingLabel}</span>`;
    marketPage.prepend(indicator);

    let startY = 0;
    let pulling = false;
    let hideTimer = null;

    function revealIndicator() {
      window.clearTimeout(hideTimer);
      indicator.hidden = false;
      indicator.setAttribute('aria-hidden', 'false');
      indicator.classList.add('is-visible');
    }

    function concealIndicator() {
      indicator.classList.remove('is-visible');
      indicator.classList.remove('is-ready');
      indicator.classList.remove('is-refreshing');
      indicator.style.removeProperty('--pull-distance');
      indicator.setAttribute('aria-hidden', 'true');
      hideTimer = window.setTimeout(() => {
        if (!indicator.classList.contains('is-visible') && !indicator.classList.contains('is-refreshing')) {
          indicator.hidden = true;
        }
      }, reducedMotion ? 10 : 220);
    }

    window.addEventListener('touchstart', (event) => {
      if (window.scrollY > 0) {
        pulling = false;
        return;
      }
      startY = event.touches[0]?.clientY || 0;
      pulling = true;
    }, { passive: true });

    window.addEventListener('touchmove', (event) => {
      if (!pulling) return;
      const currentY = event.touches[0]?.clientY || 0;
      const distance = Math.max(0, Math.min(120, currentY - startY));
      if (distance <= 0) return;
      revealIndicator();
      indicator.style.setProperty('--pull-distance', `${distance}px`);
      if (distance > 80) indicator.classList.add('is-ready');
      else indicator.classList.remove('is-ready');
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (!pulling) return;
      const ready = indicator.classList.contains('is-ready');
      pulling = false;
      if (ready) {
        revealIndicator();
        indicator.classList.add('is-refreshing');
        window.setTimeout(() => window.location.reload(), 360);
        return;
      }
      concealIndicator();
    }, { passive: true });
  }
})();
