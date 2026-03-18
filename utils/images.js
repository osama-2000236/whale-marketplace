const PLACEHOLDER_IMAGE = '/images/products/placeholder.svg';
const DEFAULT_WIDTHS = [210, 420, 630];
const CLOUDINARY_SEGMENT = '/upload/';

function isCloudinaryUrl(url) {
  return typeof url === 'string'
    && /res\.cloudinary\.com/i.test(url)
    && url.includes(CLOUDINARY_SEGMENT);
}

function normalizeWidths(widths = DEFAULT_WIDTHS) {
  const unique = Array.from(new Set(
    widths
      .map((width) => Number(width))
      .filter((width) => Number.isFinite(width) && width > 0)
  ));

  if (!unique.length) return [...DEFAULT_WIDTHS];
  return unique.sort((a, b) => a - b);
}

function parseAspectRatio(aspectRatio = '4:3', fallbackWidth = 630) {
  const [rawWidth, rawHeight] = String(aspectRatio).split(':').map((value) => Number(value));
  const widthRatio = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 4;
  const heightRatio = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 3;
  const width = Math.max(1, Math.round(fallbackWidth));
  const height = Math.max(1, Math.round((width * heightRatio) / widthRatio));

  return { widthRatio, heightRatio, width, height };
}

function transformCloudinaryUrl(url, {
  width,
  height,
  fit = 'fill',
  quality = 'auto',
  format = 'auto'
} = {}) {
  if (!isCloudinaryUrl(url)) return url;

  const transforms = ['c_fill', 'g_auto', `q_${quality}`, `f_${format}`];
  if (Number.isFinite(width) && width > 0) transforms.push(`w_${Math.round(width)}`);
  if (Number.isFinite(height) && height > 0) transforms.push(`h_${Math.round(height)}`);
  if (fit && /^(fill|fit|crop|limit)$/i.test(fit)) {
    transforms[0] = `c_${fit}`;
  }

  return url.replace(CLOUDINARY_SEGMENT, `${CLOUDINARY_SEGMENT}${transforms.join(',')}/`);
}

function buildResponsiveImage(url, options = {}) {
  const fallback = options.fallback || PLACEHOLDER_IMAGE;
  const widths = normalizeWidths(options.widths);
  const largestWidth = widths[widths.length - 1];
  const { width, height } = parseAspectRatio(options.aspectRatio || '4:3', largestWidth);
  const sizes = options.sizes || '100vw';

  if (!url) {
    return {
      src: fallback,
      srcset: `${fallback} ${largestWidth}w`,
      webpSrcset: '',
      placeholder: fallback,
      sizes,
      width,
      height
    };
  }

  if (!isCloudinaryUrl(url)) {
    return {
      src: url,
      srcset: `${url} ${largestWidth}w`,
      webpSrcset: '',
      placeholder: fallback,
      sizes,
      width,
      height
    };
  }

  const srcset = widths.map((targetWidth) => {
    const targetHeight = Math.round((targetWidth * height) / width);
    return `${transformCloudinaryUrl(url, {
      width: targetWidth,
      height: targetHeight,
      fit: options.fit,
      quality: options.quality,
      format: 'jpg'
    })} ${targetWidth}w`;
  }).join(', ');

  const webpSrcset = widths.map((targetWidth) => {
    const targetHeight = Math.round((targetWidth * height) / width);
    return `${transformCloudinaryUrl(url, {
      width: targetWidth,
      height: targetHeight,
      fit: options.fit,
      quality: options.quality,
      format: 'webp'
    })} ${targetWidth}w`;
  }).join(', ');

  return {
    src: transformCloudinaryUrl(url, {
      width,
      height,
      fit: options.fit,
      quality: options.quality,
      format: 'jpg'
    }),
    srcset,
    webpSrcset,
    placeholder: transformCloudinaryUrl(url, {
      width: 32,
      height: Math.round((32 * height) / width),
      fit: options.fit,
      quality: 20,
      format: 'jpg'
    }),
    sizes,
    width,
    height
  };
}

module.exports = {
  PLACEHOLDER_IMAGE,
  isCloudinaryUrl,
  transformCloudinaryUrl,
  buildResponsiveImage
};
