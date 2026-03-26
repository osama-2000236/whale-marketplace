// Prevent open redirect attacks by only allowing local paths
function safeRedirect(url, fallback = '/') {
  if (!url || typeof url !== 'string') return fallback;

  // Only allow paths starting with / and not // (protocol-relative)
  try {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.hostname !== 'localhost') return fallback;
    if (url.startsWith('//')) return fallback;
    if (!url.startsWith('/')) return fallback;
    return parsed.pathname + parsed.search;
  } catch {
    return fallback;
  }
}

module.exports = { safeRedirect };
