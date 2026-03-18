const express = require('express');
const { marked } = require('marked');
const DOMPurify = require('isomorphic-dompurify');

const { requireAuth, optionalAuth } = require('../middleware/auth');
const forumService = require('../services/forumService');
const prisma = require('../lib/prisma');

const router = express.Router();

// Sanitize markdown body -> safe HTML
function renderBody(raw) {
  return DOMPurify.sanitize(marked.parse(raw || ''), {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'h3', 'h4'],
    ALLOWED_ATTR: ['href', 'target']
  });
}

// GET /forum — category listing (guest allowed)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const categories = await forumService.getCategories();
    return res.render('forum/index', {
      title: 'Forum',
      categories
    });
  } catch (error) {
    return next(error);
  }
});

// GET /forum/:slug — threads in category (guest allowed)
router.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const result = await forumService.getThreadsByCategory(req.params.slug, req.query.cursor);
    if (!result) return res.status(404).render('404');

    return res.render('forum/category', {
      title: `${result.category.nameAr || result.category.name} | Forum`,
      ...result,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  } catch (error) {
    return next(error);
  }
});

// GET /forum/:slug/new — create thread form (auth required)
router.get('/:slug/new', requireAuth, async (req, res, next) => {
  try {
    const category = await prisma.forumCategory.findUnique({ where: { slug: req.params.slug } });
    if (!category) return res.status(404).render('404');

    return res.render('forum/new-thread', {
      title: 'New Forum Thread',
      category,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    return next(error);
  }
});

// POST /forum/:slug/new — submit new thread
router.post('/:slug/new', requireAuth, async (req, res, next) => {
  const { title, body, tags } = req.body;
  try {
    const category = await prisma.forumCategory.findUnique({ where: { slug: req.params.slug } });
    if (!category) return res.status(404).render('404');

    if (!title || title.trim().length < 5) {
      return res.redirect(`/forum/${req.params.slug}/new?error=title`);
    }

    if (!body || body.trim().length < 10) {
      return res.redirect(`/forum/${req.params.slug}/new?error=body`);
    }

    const tagArr = typeof tags === 'string'
      ? tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];

    const thread = await forumService.createThread(req.session.userId, category.id, {
      title: title.trim(),
      body: body.trim(),
      tags: tagArr
    });

    return res.redirect(`/forum/${req.params.slug}/${thread.slug}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    if (String(error.message).toLowerCase().includes('unique')) {
      return res.redirect(`/forum/${req.params.slug}/new?error=slug`);
    }
    return next(error);
  }
});

// GET /forum/:slug/:threadSlug — view thread (guest allowed)
router.get('/:slug/:threadSlug', optionalAuth, async (req, res, next) => {
  try {
    const thread = await forumService.getThread(req.params.threadSlug);
    if (!thread) return res.status(404).render('404');

    await forumService.incrementThreadViews(thread.id);

    // Render markdown bodies
    thread.bodyHtml = renderBody(thread.body);
    thread.replies.forEach((reply) => {
      reply.bodyHtml = renderBody(reply.body);
      reply.children.forEach((child) => {
        child.bodyHtml = renderBody(child.body);
      });
    });

    return res.render('forum/thread', {
      title: thread.title,
      thread,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  } catch (error) {
    return next(error);
  }
});

// POST /forum/:slug/:threadSlug/reply — post reply (auth required)
router.post('/:slug/:threadSlug/reply', requireAuth, async (req, res, next) => {
  const { body, parentId } = req.body;
  try {
    const thread = await prisma.forumThread.findUnique({ where: { slug: req.params.threadSlug } });
    if (!thread) return res.status(404).json({ error: 'not_found' });

    if (!body || body.trim().length < 3) {
      return res.redirect(`/forum/${req.params.slug}/${req.params.threadSlug}?error=body`);
    }

    let safeParentId = null;
    if (parentId) {
      const parent = await prisma.forumReply.findUnique({ where: { id: parentId } });
      if (parent && parent.threadId === thread.id && !parent.parentId) {
        safeParentId = parentId;
      }
    }

    await forumService.createReply(req.session.userId, thread.id, {
      body: body.trim(),
      parentId: safeParentId
    });

    return res.redirect(`/forum/${req.params.slug}/${req.params.threadSlug}#replies`);
  } catch (error) {
    return next(error);
  }
});

// POST /forum/reply/:replyId/like — AJAX like toggle
router.post('/reply/:replyId/like', requireAuth, async (req, res, next) => {
  try {
    const result = await forumService.toggleReplyLike(req.params.replyId, req.session.userId);
    if (!result) return res.status(404).json({ error: 'not_found' });

    return res.json({
      likesCount: result.likesCount,
      liked: Array.isArray(result.likedBy) ? result.likedBy.includes(req.session.userId) : false
    });
  } catch (error) {
    return next(error);
  }
});

// POST /forum/reply/:replyId/accept — mark as solution
router.post('/reply/:replyId/accept', requireAuth, async (req, res, next) => {
  try {
    const result = await forumService.acceptReply(req.params.replyId, req.session.userId);
    if (result.error) return res.status(403).json(result);

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
