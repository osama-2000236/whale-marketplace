function startsWithArabic(text = '') {
  return /^[\u0600-\u06FF]/.test(String(text).trim());
}

function getDirection(text = '') {
  return startsWithArabic(text) ? 'rtl' : 'ltr';
}

function detectDir(text = '') {
  const value = String(text || '').trim();
  if (!value) return 'auto';

  const hasArabic = /[\u0600-\u06FF]/.test(value);
  const hasLatin = /[A-Za-z]/.test(value);

  if (hasArabic && hasLatin) return 'auto';
  if (hasArabic) return 'rtl';
  return 'ltr';
}

function timeAgo(input) {
  if (!input) return 'الآن | Just now';

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'الآن | Just now';

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'الآن | Just now';
  if (diffMs < hour) {
    const m = Math.floor(diffMs / minute);
    return `${m} دقيقة | ${m} min ago`;
  }
  if (diffMs < day) {
    const h = Math.floor(diffMs / hour);
    return `${h} ساعة | ${h} h ago`;
  }

  const d = Math.floor(diffMs / day);
  return `${d} يوم | ${d} d ago`;
}

function isModerator(user) {
  if (!user) return false;
  return ['ADMIN', 'MODERATOR'].includes(user.role);
}

module.exports = {
  startsWithArabic,
  getDirection,
  detectDir,
  timeAgo,
  isModerator
};
