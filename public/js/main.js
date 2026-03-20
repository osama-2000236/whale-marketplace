document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) {
    const onScroll = () => {
      navbar.style.boxShadow = window.scrollY > 10
        ? '0 10px 40px color-mix(in srgb, var(--ui-ink, #0d1b26) 12%, transparent)'
        : '0 1px 0 color-mix(in srgb, var(--ui-border-strong, #d8e8f0) 70%, transparent)';
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const allMenus = Array.from(document.querySelectorAll('details.user-menu'));
  if (allMenus.length) {
    document.addEventListener('click', (event) => {
      allMenus.forEach((menu) => {
        if (!menu.contains(event.target)) menu.removeAttribute('open');
      });
    });
  }

  // Nav dropdown toggle (notifications, user menu)
  document.querySelectorAll('.nav-dropdown').forEach((dd) => {
    const btn = dd.querySelector('.btn-icon, .user-avatar-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dd.classList.contains('open');
      document.querySelectorAll('.nav-dropdown.open').forEach((d) => d.classList.remove('open'));
      if (!wasOpen) dd.classList.add('open');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.nav-dropdown.open').forEach((d) => d.classList.remove('open'));
  });

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      navToggle.classList.toggle('active');
    });
  }

  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const isDark = document.documentElement.dataset.theme === 'dark';
      const next = isDark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      document.documentElement.classList.toggle('dark', next === 'dark');
      try { localStorage.setItem('whale-theme', next); } catch (_) {}
      const csrf = window.getCsrfToken();
      try {
        await fetch('/prefs/theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `_csrf=${encodeURIComponent(csrf)}&theme=${encodeURIComponent(next)}`
        });
      } catch (_) {}
    });
  }
});

window.getCsrfToken = function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatch(text, query) {
  const source = String(text || '');
  if (!query) return escapeHtml(source);
  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  return escapeHtml(source).replace(pattern, '<mark class="sd-match">$1</mark>');
}

// Search autocomplete
(function () {
  const inputs = document.querySelectorAll('.nav-search input, .whale-market-search, input[name="q"]');
  if (!inputs.length) return;

  const lang = document.documentElement.getAttribute('lang') || 'ar';
  const body = document.body;
  const labels = {
    category: body?.dataset?.uiCategory || (lang === 'ar' ? 'فئة' : 'Category'),
    search: body?.dataset?.uiSearch || (lang === 'ar' ? 'بحث' : 'Search'),
    recent: body?.dataset?.uiRecentSearches || (lang === 'ar' ? 'آخر عمليات البحث' : 'Recent searches'),
    popular: body?.dataset?.uiPopularSearches || (lang === 'ar' ? 'الأكثر بحثاً' : 'Popular searches'),
    remove: body?.dataset?.uiRemove || (lang === 'ar' ? 'حذف' : 'Remove'),
    noResults: body?.dataset?.uiNoResults || (lang === 'ar' ? 'لا توجد نتائج' : 'No results')
  };
  const recentKey = 'whale-recent-searches';
  const defaultPopular = lang === 'ar'
    ? ['RTX 3060', 'رام الله', 'آيفون 13', 'بلايستيشن 5', 'سماعات']
    : ['RTX 3060', 'Ramallah', 'iPhone 13', 'PlayStation 5', 'Headset'];

  function getRecentSearches() {
    try {
      const parsed = JSON.parse(localStorage.getItem(recentKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 5) : [];
    } catch (_error) {
      return [];
    }
  }

  function saveRecentSearch(term) {
    const clean = String(term || '').trim();
    if (clean.length < 2) return;
    const next = [clean, ...getRecentSearches().filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
    try {
      localStorage.setItem(recentKey, JSON.stringify(next));
    } catch (_error) {
      // ignore storage failures
    }
  }

  function removeRecentSearch(term) {
    const next = getRecentSearches().filter((item) => item !== term);
    try {
      localStorage.setItem(recentKey, JSON.stringify(next));
    } catch (_error) {
      // ignore storage failures
    }
    return next;
  }

  inputs.forEach((input) => {
    let timer = null;
    let dropdown = null;
    let activeIndex = -1;
    let activeItems = [];

    function ensureDropdown() {
      if (dropdown) return dropdown;
      const wrap = input.closest('.nav-search') || input.closest('.whale-search-form') || input.parentElement;
      if (!wrap) return null;
      wrap.style.position = 'relative';
      dropdown = document.createElement('div');
      dropdown.className = 'search-dropdown whale-search-dropdown';
      wrap.appendChild(dropdown);
      return dropdown;
    }

    function closeDropdown() {
      activeIndex = -1;
      activeItems = [];
      if (!dropdown) return;
      dropdown.remove();
      dropdown = null;
    }

    function syncActiveItem() {
      activeItems.forEach((item, index) => {
        item.classList.toggle('is-active', index === activeIndex);
      });
    }

    function buildSection(title, items) {
      if (!items.length) return '';
      return `
        <div class="sd-section">
          <div class="sd-section-title">${escapeHtml(title)}</div>
          ${items.join('')}
        </div>
      `;
    }

    function recentMarkup(query) {
      return getRecentSearches()
        .filter((term) => !query || term.toLowerCase().includes(query.toLowerCase()))
        .map((term) => `
          <button type="button" class="sd-item sd-item-action" data-search-term="${escapeHtml(term)}">
            <span class="sd-icon">🕘</span>
            <span class="sd-label">${highlightMatch(term, query)}</span>
            <span class="sd-actions">
              <span class="sd-meta">${escapeHtml(labels.recent)}</span>
              <span class="sd-remove" data-remove-term="${escapeHtml(term)}" aria-label="${escapeHtml(labels.remove)}">✕</span>
            </span>
          </button>
        `);
    }

    function popularMarkup(query) {
      return defaultPopular
        .filter((term) => !query || term.toLowerCase().includes(query.toLowerCase()))
        .map((term) => `
          <button type="button" class="sd-item sd-item-action" data-search-term="${escapeHtml(term)}">
            <span class="sd-icon">🔥</span>
            <span class="sd-label">${highlightMatch(term, query)}</span>
            <span class="sd-meta">${escapeHtml(labels.popular)}</span>
          </button>
        `);
    }

    function attachEvents() {
      if (!dropdown) return;
      activeItems = Array.from(dropdown.querySelectorAll('.sd-item'));
      activeIndex = -1;

      dropdown.addEventListener('mousemove', (event) => {
        const target = event.target.closest('.sd-item');
        if (!target) return;
        activeIndex = activeItems.indexOf(target);
        syncActiveItem();
      });

      dropdown.addEventListener('click', (event) => {
        const removeTarget = event.target.closest('[data-remove-term]');
        if (removeTarget) {
          event.preventDefault();
          removeRecentSearch(removeTarget.dataset.removeTerm || '');
          renderLocalSections(String(input.value || '').trim());
          return;
        }

        const termTarget = event.target.closest('[data-search-term]');
        if (termTarget) {
          const term = termTarget.dataset.searchTerm || '';
          saveRecentSearch(term);
          input.value = term;
          closeDropdown();
          if (typeof input.form?.requestSubmit === 'function') {
            input.form.requestSubmit();
          } else if (term) {
            window.location.href = `/whale?q=${encodeURIComponent(term)}`;
          }
        }
      });
    }

    function renderHtml(html) {
      const dd = ensureDropdown();
      if (!dd) return;
      dd.innerHTML = html;
      attachEvents();
    }

    function renderLocalSections(query) {
      const recent = recentMarkup(query);
      const popular = popularMarkup(query);
      const html = [
        buildSection(labels.recent, recent),
        buildSection(labels.popular, popular)
      ].join('');

      if (!html) {
        closeDropdown();
        return;
      }
      renderHtml(html);
    }

    async function renderRemoteSuggestions(query) {
      try {
        const response = await fetch(`/whale/search/suggestions?q=${encodeURIComponent(query)}`, {
          headers: { Accept: 'application/json' }
        });
        const data = await response.json();
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

        const remoteMarkup = suggestions.map((item) => {
          if (item.type === 'category') {
            return `
              <a href="${item.url}" class="sd-item" data-search-link>
                <span class="sd-icon">${escapeHtml(item.icon || '📂')}</span>
                <span class="sd-label">${highlightMatch(item.label, query)}</span>
                <span class="sd-meta">${escapeHtml(labels.category)}</span>
              </a>
            `;
          }

          const thumb = item.image
            ? `<img src="${item.image}" alt="" class="sd-thumb" loading="lazy">`
            : '<span class="sd-thumb sd-thumb-fallback">📦</span>';

          return `
            <a href="${item.url}" class="sd-item" data-search-link>
              ${thumb}
              <span class="sd-label">${highlightMatch(item.label, query)}</span>
              <span class="sd-price">${escapeHtml(item.price || '')}</span>
            </a>
          `;
        });

        const localSections = [
          buildSection(labels.recent, recentMarkup(query)),
          buildSection(labels.popular, popularMarkup(query))
        ].filter(Boolean);

        if (!remoteMarkup.length && !localSections.length) {
          renderHtml(`<div class="sd-empty">${escapeHtml(labels.noResults)}</div>`);
          return;
        }

        renderHtml([
          buildSection(labels.search || '', remoteMarkup),
          ...localSections
        ].filter(Boolean).join(''));

        dropdown?.querySelectorAll('[data-search-link]').forEach((item) => {
          item.addEventListener('click', () => saveRecentSearch(query));
        });
      } catch (_error) {
        renderLocalSections(query);
      }
    }

    input.addEventListener('focus', () => {
      const query = String(input.value || '').trim();
      if (query.length < 2) renderLocalSections(query);
    });

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const query = String(input.value || '').trim();
      if (query.length < 2) {
        renderLocalSections(query);
        return;
      }

      timer = setTimeout(() => {
        renderRemoteSuggestions(query);
      }, 180);
    });

    input.addEventListener('keydown', (event) => {
      if (!dropdown) return;

      if (event.key === 'Escape') {
        closeDropdown();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIndex = Math.min(activeItems.length - 1, activeIndex + 1);
        syncActiveItem();
        activeItems[activeIndex]?.scrollIntoView({ block: 'nearest' });
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        syncActiveItem();
        activeItems[activeIndex]?.scrollIntoView({ block: 'nearest' });
      }

      if (event.key === 'Enter') {
        const term = String(input.value || '').trim();
        if (activeIndex >= 0 && activeItems[activeIndex]) {
          event.preventDefault();
          activeItems[activeIndex].click();
          return;
        }
        saveRecentSearch(term);
      }
    });

    input.form?.addEventListener('submit', () => {
      saveRecentSearch(input.value);
    });

    document.addEventListener('click', (event) => {
      if (input.contains(event.target)) return;
      if (dropdown && dropdown.contains(event.target)) return;
      closeDropdown();
    });
  });
})();
