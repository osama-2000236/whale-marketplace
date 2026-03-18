const {
  PLACEHOLDER_IMAGE,
  isCloudinaryUrl,
  transformCloudinaryUrl,
  buildResponsiveImage
} = require('../../../utils/images');

describe('utils/images', () => {
  test('detects Cloudinary URLs', () => {
    expect(isCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/v123/demo.jpg')).toBe(true);
    expect(isCloudinaryUrl('/uploads/whale/demo.jpg')).toBe(false);
  });

  test('injects Cloudinary transformations into upload URLs', () => {
    const result = transformCloudinaryUrl(
      'https://res.cloudinary.com/demo/image/upload/v123/demo.jpg',
      { width: 420, height: 315, quality: 'auto', format: 'webp' }
    );

    expect(result).toContain('/upload/c_fill,g_auto,q_auto,f_webp,w_420,h_315/');
  });

  test('returns placeholder data when no image is provided', () => {
    const result = buildResponsiveImage(null, { widths: [210, 420], aspectRatio: '4:3' });

    expect(result.src).toBe(PLACEHOLDER_IMAGE);
    expect(result.webpSrcset).toBe('');
    expect(result.width).toBe(420);
    expect(result.height).toBe(315);
  });

  test('builds responsive Cloudinary sources for cards', () => {
    const result = buildResponsiveImage(
      'https://res.cloudinary.com/demo/image/upload/v123/demo.jpg',
      {
        widths: [210, 420, 630],
        sizes: '(min-width: 720px) 33vw, 100vw',
        aspectRatio: '4:3'
      }
    );

    expect(result.webpSrcset).toContain('f_webp');
    expect(result.srcset).toContain('f_jpg');
    expect(result.sizes).toBe('(min-width: 720px) 33vw, 100vw');
    expect(result.placeholder).toContain('q_20');
  });
});
