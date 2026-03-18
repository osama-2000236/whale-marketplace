const express = require('express');
const rateLimit = require('express-rate-limit');

const { requireAuth } = require('../middleware/auth');
const postService = require('../services/postService');

const apiRouter = express.Router();
const webRouter = express.Router();

const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Comment rate limit exceeded (30/hour)' }
});

apiRouter.post('/', requireAuth, commentLimiter, async (req, res) => {
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

apiRouter.delete('/:id', requireAuth, async (req, res) => {
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
  apiRouter,
  webRouter
};
