const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const forumService = require('../services/forumService');
const { sanitizeText, sanitizeTags } = require('../utils/sanitize');
const { renderMarkdown } = require('../lib/markdown');

router.get('/', async (req, res, next) => {
  try {
    const categories = await forumService.getCategories();
    res.render('forum/index', { title: res.locals.t('forum.title'), categories });
  } catch (e) { next(e); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const result = await forumService.getThreadsByCategory(req.params.slug, req.query.cursor);
    if (!result) return res.status(404).render('404', { title: 'Not Found' });
    res.render('forum/category', { title: result.category.name, ...result });
  } catch (e) { next(e); }
});

router.get('/:slug/new', requireAuth, async (req, res, next) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = require('../lib/prisma');
    const category = await prisma.forumCategory.findUnique({ where: { slug: req.params.slug } });
    if (!category) return res.status(404).render('404', { title: 'Not Found' });
    res.render('forum/new-thread', { title: 'New Thread', category });
  } catch (e) { next(e); }
});

router.post('/:slug/new', requireAuth, async (req, res, next) => {
  try {
    const prisma = require('../lib/prisma');
    const category = await prisma.forumCategory.findUnique({ where: { slug: req.params.slug } });
    if (!category) return res.status(404).render('404', { title: 'Not Found' });

    const title = sanitizeText(req.body.title, 200);
    const body = sanitizeText(req.body.body, 10000);
    if (title.length < 5) return res.render('forum/new-thread', { title: 'New Thread', category, error: 'Title must be at least 5 characters' });
    if (body.length < 10) return res.render('forum/new-thread', { title: 'New Thread', category, error: 'Body must be at least 10 characters' });

    const thread = await forumService.createThread(req.user.id, category.id, {
      title, body, tags: sanitizeTags(req.body.tags),
    });
    res.redirect(`/forum/${req.params.slug}/${thread.slug}`);
  } catch (e) { next(e); }
});

router.get('/:slug/:threadSlug', async (req, res, next) => {
  try {
    const thread = await forumService.getThread(req.params.threadSlug);
    if (!thread) return res.status(404).render('404', { title: 'Not Found' });

    forumService.incrementThreadViews(thread.id);

    // Render markdown for thread body and replies
    thread.renderedBody = renderMarkdown(thread.body);
    for (const reply of thread.replies) {
      reply.renderedBody = renderMarkdown(reply.body);
      for (const child of reply.children || []) {
        child.renderedBody = renderMarkdown(child.body);
      }
    }

    res.render('forum/thread', { title: thread.title, thread });
  } catch (e) { next(e); }
});

router.post('/:slug/:threadSlug/reply', requireAuth, async (req, res, next) => {
  try {
    const thread = await forumService.getThread(req.params.threadSlug);
    if (!thread) return res.status(404).render('404', { title: 'Not Found' });

    const body = sanitizeText(req.body.body, 5000);
    if (body.length < 3) return res.redirect(`/forum/${req.params.slug}/${req.params.threadSlug}?error=body_too_short`);

    let parentId = req.body.parentId || null;
    // Validate parent is top-level
    if (parentId) {
      const parent = thread.replies.find((r) => r.id === parentId);
      if (!parent) parentId = null;
    }

    await forumService.createReply(req.user.id, thread.id, { body, parentId });
    res.redirect(`/forum/${req.params.slug}/${req.params.threadSlug}`);
  } catch (e) { next(e); }
});

router.post('/reply/:replyId/like', requireAuth, async (req, res) => {
  try {
    const result = await forumService.toggleReplyLike(req.params.replyId, req.user.id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/reply/:replyId/accept', requireAuth, async (req, res) => {
  try {
    const result = await forumService.acceptReply(req.params.replyId, req.user.id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
