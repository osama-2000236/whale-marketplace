const PLACEHOLDER_IMAGE = '/images/placeholder.png';
const DEFAULT_WIDTHS = [210, 420, 630];

function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com');
}

function transformCloudinaryUrl(url, { width, height, quality = 'auto', format = 'auto', crop = 'fill', gravity = 'auto' } = {}) {
  if (!isCloudinaryUrl(url)) return url;
  const parts = [`c_${crop}`, `g_${gravity}`, `q_${quality}`, `f_${format}`];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  return url.replace('/upload/', `/upload/${parts.join(',')}/`);
}

// Backward-compatible alias
function cloudinaryTransform(url, width, options = {}) {
  return transformCloudinaryUrl(url, { width, ...options });
}

function buildResponsiveImage(url, options = {}) {
  if (!url) {
    return { src: PLACEHOLDER_IMAGE, srcset: '', webpSrcset: '', placeholder: PLACEHOLDER_IMAGE, width: 420, height: 315 };
  }

  const widths = options.widths || DEFAULT_WIDTHS;
  const aspectRatio = options.aspectRatio || '4:3';
  const [aw, ah] = aspectRatio.split(':').map(Number);
  const baseWidth = widths[1] || widths[0];
  const height = Math.round((baseWidth * ah) / aw);

  if (!isCloudinaryUrl(url)) {
    return { src: url, srcset: '', webpSrcset: '', placeholder: url, width: baseWidth, height };
  }

  const srcset = widths
    .map((w) => `${transformCloudinaryUrl(url, { width: w, height: Math.round((w * ah) / aw), format: 'jpg' })} ${w}w`)
    .join(', ');
  const webpSrcset = widths
    .map((w) => `${transformCloudinaryUrl(url, { width: w, height: Math.round((w * ah) / aw), format: 'webp' })} ${w}w`)
    .join(', ');
  const sizes = options.sizes || `(max-width: 600px) ${widths[0]}px, ${widths[1]}px`;

  return {
    src: transformCloudinaryUrl(url, { width: baseWidth, height }),
    srcset,
    webpSrcset,
    placeholder: transformCloudinaryUrl(url, { width: widths[0], height: Math.round((widths[0] * ah) / aw), quality: 20 }),
    width: baseWidth,
    height,
    sizes,
  };
}

module.exports = { buildResponsiveImage, cloudinaryTransform, transformCloudinaryUrl, isCloudinaryUrl, PLACEHOLDER: PLACEHOLDER_IMAGE, PLACEHOLDER_IMAGE };
