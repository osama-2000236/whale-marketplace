function startsWithArabic(text) {
  if (!text) return false;
  return /[\u0600-\u06FF]/.test(String(text).charAt(0));
}

function getDirection(text) {
  return startsWithArabic(text) ? 'rtl' : 'ltr';
}

function detectDir(text) {
  if (!text) return 'auto';
  return startsWithArabic(text) ? 'rtl' : 'ltr';
}

function timeAgo(input, lang = 'ar') {
  if (!input) return '';
  const now = Date.now();
  const date = new Date(input);
  const diff = now - date.getTime();
  if (diff < 0) return lang === 'ar' ? 'الآن' : 'now';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (lang === 'ar') {
    if (seconds < 60) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 30) return `منذ ${days} يوم`;
    if (months < 12) return `منذ ${months} شهر`;
    return `منذ ${years} سنة`;
  }
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

function isModerator(user) {
  return user && ['ADMIN', 'MODERATOR'].includes(user.role);
}

module.exports = { startsWithArabic, getDirection, detectDir, timeAgo, isModerator };
