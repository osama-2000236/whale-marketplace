(function () {
  'use strict';

  function getEventElement(target) {
    if (!target) return null;
    if (target.nodeType === 1) return target;
    return target.parentElement || null;
  }

  // Ensure skip-link target exists across views
  var mainEl = document.querySelector('main');
  if (mainEl && !mainEl.id) {
    mainEl.id = 'main';
  }

  var canonicalLocaleUrl = new URL(window.location.href);
  if (canonicalLocaleUrl.searchParams.has('lang')) {
    canonicalLocaleUrl.searchParams.delete('lang');
    window.history.replaceState({}, '', canonicalLocaleUrl.toString());
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
    var target = getEventElement(e.target);
    if (!target) return;

    if (target.closest('[data-theme-toggle]')) {
      var cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    }
  });

  // 2. Language toggle
  document.addEventListener('click', function (e) {
    var target = getEventElement(e.target);
    if (!target) return;

    var btn = target.closest('[data-locale]');
    if (!btn) return;
    var locale = btn.getAttribute('data-locale');
    var u = new URL(location.href);
    u.searchParams.set('lang', locale);
    location.href = u.toString();
  });

  // 3. Image gallery
  document.addEventListener('click', function (e) {
    var target = getEventElement(e.target);
    if (!target) return;

    var thumb = target.closest('.gallery-thumb');
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
    var target = getEventElement(e.target);
    if (!target) return;

    var form = target.closest('form[data-confirm]');
    if (form && !window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
  });

  // 7. Multipart forms submit through fetch so CSRF headers survive file uploads.
  document.addEventListener('submit', function (e) {
    var target = getEventElement(e.target);
    if (!target) return;

    var form = target.closest('form[enctype="multipart/form-data"]');
    if (!form) return;
    if (!window.fetch || !window.FormData) return;

    e.preventDefault();

    var submitter = e.submitter || form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitter) submitter.disabled = true;

    fetch(form.action, {
      method: (form.method || 'POST').toUpperCase(),
      body: new window.FormData(form),
      headers: {
        'x-csrf-token': document.querySelector('meta[name="csrf-token"]')?.content || '',
      },
      redirect: 'follow',
    })
      .then(function (response) {
        if (!response.ok && !response.redirected) throw new Error('Multipart submit failed');
        window.location.href = response.url || window.location.href;
      })
      .catch(function () {
        window.HTMLFormElement.prototype.submit.call(form);
      })
      .finally(function () {
        if (submitter) submitter.disabled = false;
      });
  });

  // 8. Save/unsave toggle
  document.addEventListener('click', function (e) {
    var target = getEventElement(e.target);
    if (!target) return;

    var btn = target.closest('[data-save-listing]');
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

  // 9. Mobile nav toggle
  document.addEventListener('click', function (e) {
    var target = getEventElement(e.target);
    if (!target) return;

    var toggle = target.closest('.navbar-toggle');
    if (toggle) {
      var nav = document.querySelector('.navbar-nav');
      if (nav) {
        var isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    }
  });

  // 10. User menu dropdown
  document.addEventListener('click', function (e) {
    var target = getEventElement(e.target);
    if (!target) return;

    var trigger = target.closest('.user-menu-trigger');
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

  // 11. Filter auto-submit
  var ff = document.querySelector('.filter-form');
  if (ff)
    ff.querySelectorAll('select').forEach(function (s) {
      s.addEventListener('change', function () {
        ff.submit();
      });
    });
})();
