function strip(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

function truncate(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function sanitizeBody(body, schema) {
  const clean = {};
  for (const [key, maxLen] of Object.entries(schema)) {
    if (body[key] !== undefined && body[key] !== null) {
      if (typeof body[key] === 'string') {
        clean[key] = truncate(strip(body[key]), maxLen);
      } else if (typeof body[key] === 'number' || typeof body[key] === 'boolean') {
        clean[key] = body[key];
      } else {
        clean[key] = body[key];
      }
    }
  }
  return clean;
}

module.exports = { strip, truncate, sanitizeBody };
