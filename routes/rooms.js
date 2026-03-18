const express = require('express');

const { requireAuth, optionalAuth } = require('../middleware/auth');
const roomService = require('../services/roomService');
const postService = require('../services/postService');

const webRouter = express.Router();
const apiRouter = express.Router();

webRouter.get('/rooms', optionalAuth, async (req, res, next) => {
  try {
    const result = await roomService.listRooms({
      search: req.query.q,
      cursor: req.query.cursor,
      limit: Number(req.query.limit) || 24,
      userId: req.user?.id
    });

    return res.render('rooms/index', {
      title: 'غرف الألعاب | Game Rooms',
      rooms: result.items,
      yourRooms: result.yourRooms,
      pageInfo: result.pageInfo,
      searchQuery: req.query.q || ''
    });
  } catch (error) {
    return next(error);
  }
});

webRouter.get('/rooms/:slug', optionalAuth, async (req, res, next) => {
  try {
    const room = await roomService.getRoomBySlug(req.params.slug, req.user?.id);
    if (!room) {
      return res.status(404).render('404', { title: 'الغرفة غير موجودة | Room not found' });
    }

    const feed = await postService.listRoomPosts({
      roomId: room.id,
      cursor: req.query.cursor,
      limit: 10
    });

    return res.render('rooms/detail', {
      title: `${room.nameAr} | ${room.name}`,
      room,
      posts: feed.items,
      pageInfo: feed.pageInfo
    });
  } catch (error) {
    return next(error);
  }
});

webRouter.post('/rooms/:slug/join', requireAuth, async (req, res) => {
  try {
    await roomService.toggleRoomMembership({
      userId: req.user.id,
      slug: req.params.slug
    });

    return res.redirect(`/rooms/${req.params.slug}`);
  } catch (error) {
    return res.status(400).render('error', {
      title: 'خطأ | Error',
      message: error.message
    });
  }
});

apiRouter.get('/', optionalAuth, async (req, res) => {
  try {
    const result = await roomService.listRooms({
      search: req.query.q,
      cursor: req.query.cursor,
      limit: Number(req.query.limit) || 24,
      userId: req.user?.id
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const room = await roomService.getRoomBySlug(req.params.slug, req.user?.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const posts = await postService.listRoomPosts({
      roomId: room.id,
      cursor: req.query.cursor,
      limit: Number(req.query.limit) || 10
    });

    return res.json({ room, posts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/:slug/join', requireAuth, async (req, res) => {
  try {
    const result = await roomService.toggleRoomMembership({
      userId: req.user.id,
      slug: req.params.slug
    });

    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = {
  webRouter,
  apiRouter
};
