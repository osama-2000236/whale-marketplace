const express = require('express');
const rateLimit = require('express-rate-limit');

const { requireAuth, optionalAuth } = require('../middleware/auth');
const postService = require('../services/postService');
const marketplaceService = require('../services/marketplaceService');
const { upload, storeFiles } = require('../utils/upload');
const { getUserRooms } = require('../services/userService');

const webRouter = express.Router();
const apiRouter = express.Router();

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Post rate limit exceeded (10/hour)' }
});

const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Comment rate limit exceeded (30/hour)' }
});

webRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const [feed, joinedRooms, marketSnapshot] = await Promise.all([
      postService.listFeed({
        userId: req.user.id,
        cursor: req.query.cursor,
        limit: Number(req.query.limit) || 10
      }),
      getUserRooms(req.user.id, 20),
      marketplaceService.listListings({ limit: 6 })
    ]);

    return res.render('feed', {
      title: 'الرئيسية | Home Feed',
      posts: feed.items,
      pageInfo: feed.pageInfo,
      joinedRooms,
      marketSnapshot: marketSnapshot.items || [],
      postType: req.query.postType || ''
    });
  } catch (error) {
    return next(error);
  }
});

webRouter.post('/posts', requireAuth, postLimiter, upload.array('images', 4), async (req, res) => {
  try {
    const images = await storeFiles(req.files || [], 'uploads/posts', 4);

    await postService.createPost({
      authorId: req.user.id,
      content: req.body.content,
      images,
      roomId: req.body.roomId || null,
      type: req.body.type || 'UPDATE'
    });

    return res.redirect(req.headers.referer || '/');
  } catch (error) {
    return res.status(400).render('error', {
      title: 'خطأ | Error',
      message: error.message
    });
  }
});

webRouter.post('/posts/:id/like', requireAuth, async (req, res) => {
  try {
    const result = await postService.togglePostLike({
      userId: req.user.id,
      postId: req.params.id
    });

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json(result);
    }

    return res.redirect(req.headers.referer || '/');
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

webRouter.post('/posts/:id/delete', requireAuth, async (req, res) => {
  try {
    await postService.deletePost({
      postId: req.params.id,
      actor: req.user
    });

    return res.redirect(req.headers.referer || '/');
  } catch (error) {
    return res.status(403).render('error', {
      title: 'غير مصرح | Forbidden',
      message: error.message
    });
  }
});

webRouter.post('/comments', requireAuth, commentLimiter, async (req, res) => {
  try {
    await postService.createComment({
      authorId: req.user.id,
      postId: req.body.postId,
      content: req.body.content,
      parentCommentId: req.body.parentCommentId || null
    });

    return res.redirect(req.headers.referer || '/');
  } catch (error) {
    return res.status(400).render('error', {
      title: 'خطأ | Error',
      message: error.message
    });
  }
});

webRouter.post('/comments/:id/delete', requireAuth, async (req, res) => {
  try {
    await postService.deleteComment({
      commentId: req.params.id,
      actor: req.user
    });

    return res.redirect(req.headers.referer || '/');
  } catch (error) {
    return res.status(403).render('error', {
      title: 'غير مصرح | Forbidden',
      message: error.message
    });
  }
});

apiRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const feed = await postService.listFeed({
      userId: req.user?.id,
      cursor: req.query.cursor,
      limit: Number(req.query.limit) || 10
    });

    return res.json(feed);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/', requireAuth, postLimiter, upload.array('images', 4), async (req, res) => {
  try {
    const images = await storeFiles(req.files || [], 'uploads/posts', 4);

    const post = await postService.createPost({
      authorId: req.user.id,
      content: req.body.content,
      images,
      roomId: req.body.roomId || null,
      type: req.body.type || 'UPDATE'
    });

    return res.status(201).json({ post });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    await postService.deletePost({
      postId: req.params.id,
      actor: req.user
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(403).json({ error: error.message });
  }
});

apiRouter.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const result = await postService.togglePostLike({
      userId: req.user.id,
      postId: req.params.id
    });

    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get('/:id/comments', optionalAuth, async (req, res) => {
  try {
    const result = await postService.listComments(req.params.id, {
      cursor: req.query.cursor,
      limit: Number(req.query.limit) || 10
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/comments', requireAuth, commentLimiter, async (req, res) => {
  try {
    const comment = await postService.createComment({
      authorId: req.user.id,
      postId: req.body.postId,
      content: req.body.content,
      parentCommentId: req.body.parentCommentId || null
    });

    return res.status(201).json({ comment });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.delete('/comments/:id', requireAuth, async (req, res) => {
  try {
    await postService.deleteComment({
      commentId: req.params.id,
      actor: req.user
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(403).json({ error: error.message });
  }
});

module.exports = {
  webRouter,
  apiRouter
};
