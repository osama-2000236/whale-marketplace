(function () {
  'use strict';

  // Ensure skip-link target exists across views
  var mainEl = document.querySelector('main');
  if (mainEl && !mainEl.id) {
    mainEl.id = 'main';
  }

  // 1. Theme toggle
  var THEME_KEY = 'whale-theme';
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    var icon = document.querySelector('.theme-toggle-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-theme-toggle]')) {
      var cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    }
  });

  // 2. Language toggle
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-locale]');
    if (!btn) return;
    var locale = btn.getAttribute('data-locale');
    var token = document.querySelector('meta[name="csrf-token"]')?.content;
    fetch('/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token || '' },
      body: JSON.stringify({ locale: locale }),
    })
      .then(function () {
        location.reload();
      })
      .catch(function () {
        var u = new URL(location);
        u.searchParams.set('lang', locale);
        location.href = u;
      });
  });

  // 3. Image gallery
  document.addEventListener('click', function (e) {
    var thumb = e.target.closest('.gallery-thumb');
    if (!thumb) return;
    var src = thumb.querySelector('img')?.src;
    var main = document.querySelector('.gallery-main img');
    if (main && src) {
      main.src = src;
      document.querySelectorAll('.gallery-thumb').forEach(function (t) {
        t.classList.remove('active');
      });
      thumb.classList.add('active');
    }
  });

  // 4. Flash auto-dismiss
  setTimeout(function () {
    document.querySelectorAll('.flash').forEach(function (el) {
      el.style.transition = 'opacity 0.4s, transform 0.4s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(function () {
        el.remove();
      }, 400);
    });
  }, 4000);

  // 5. CSRF token for fetch
  var origFetch = window.fetch;
  window.fetch = function (url, opts) {
    opts = opts || {};
    if (opts.method && opts.method !== 'GET' && opts.method !== 'HEAD') {
      opts.headers = opts.headers || {};
      if (!opts.headers['x-csrf-token']) {
        opts.headers['x-csrf-token'] =
          document.querySelector('meta[name="csrf-token"]')?.content || '';
      }
    }
    return origFetch.call(this, url, opts);
  };

  // 6. Confirm dialogs
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-confirm]');
    if (form && !window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
  });

  // 7. Save/unsave toggle
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-save-listing]');
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute('data-save-listing');
    fetch('/whale/listing/' + id + '/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        var icon = btn.querySelector('.save-icon') || btn;
        btn.classList.toggle('saved', d.saved);
        icon.textContent = d.saved ? '❤️' : '🤍';
      })
      .catch(function () {});
  });

  // Mobile nav toggle
  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('.navbar-toggle');
    if (toggle) {
      var nav = document.querySelector('.navbar-nav');
      if (nav) {
        var isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    }
  });

  // User menu dropdown
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.user-menu-trigger');
    if (trigger) {
      var menu = trigger.closest('.user-menu');
      var isOpen = menu?.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      return;
    }
    document.querySelectorAll('.user-menu.open').forEach(function (m) {
      m.classList.remove('open');
      var t = m.querySelector('.user-menu-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  });

  // Filter auto-submit
  var ff = document.querySelector('.filter-form');
  if (ff)
    ff.querySelectorAll('select').forEach(function (s) {
      s.addEventListener('change', function () {
        ff.submit();
      });
    });
})();
