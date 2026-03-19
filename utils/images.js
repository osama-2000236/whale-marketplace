const PLACEHOLDER = '/images/placeholder.png';
const DEFAULT_WIDTHS = [210, 420, 630];

function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com');
}

function cloudinaryTransform(url, width, options = {}) {
  if (!isCloudinaryUrl(url)) return url;
  const quality = options.quality || 'auto';
  const format = options.format || 'auto';
  const transform = `w_${width},q_${quality},f_${format},c_limit`;
  return url.replace('/upload/', `/upload/${transform}/`);
}

function buildResponsiveImage(url, options = {}) {
  if (!url) {
    return { src: PLACEHOLDER, srcset: '', webpSrcset: '', placeholder: PLACEHOLDER, width: 420, height: 315 };
  }

  const widths = options.widths || DEFAULT_WIDTHS;
  const aspectRatio = options.aspectRatio || '4:3';
  const [aw, ah] = aspectRatio.split(':').map(Number);
  const baseWidth = widths[1] || widths[0];
  const height = Math.round((baseWidth * ah) / aw);

  if (!isCloudinaryUrl(url)) {
    return { src: url, srcset: '', webpSrcset: '', placeholder: url, width: baseWidth, height };
  }

  const srcset = widths.map((w) => `${cloudinaryTransform(url, w)} ${w}w`).join(', ');
  const webpSrcset = widths
    .map((w) => `${cloudinaryTransform(url, w, { format: 'webp' })} ${w}w`)
    .join(', ');
  const sizes = options.sizes || `(max-width: 600px) ${widths[0]}px, ${widths[1]}px`;

  return {
    src: cloudinaryTransform(url, baseWidth),
    srcset,
    webpSrcset,
    placeholder: cloudinaryTransform(url, widths[0], { quality: 30 }),
    width: baseWidth,
    height,
    sizes,
  };
}

module.exports = { buildResponsiveImage, cloudinaryTransform, PLACEHOLDER };
