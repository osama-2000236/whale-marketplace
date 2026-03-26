const SAFE_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'h3',
  'h4',
];

let _marked, _DOMPurify;

function ensureLoaded() {
  if (!_marked) {
    _marked = require('marked').marked;
    _DOMPurify = require('isomorphic-dompurify');
  }
}

function renderMarkdown(text) {
  if (!text) return '';
  ensureLoaded();
  const raw = _marked.parse(text);
  return _DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

module.exports = { renderMarkdown };
