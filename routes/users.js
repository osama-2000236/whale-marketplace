const express = require('express');
const { requireAuth } = require('../middleware/auth');
const userService = require('../services/userService');
const { upload, storeOneFile } = require('../utils/upload');

const webRouter = express.Router();
const apiRouter = express.Router();

// Web
webRouter.get('/u/:username', async (req, res, next) => {
  try {
    const profile = await userService.getUserProfileByUsername(req.params.username, req.user?.id);
    if (!profile) return res.status(404).render('404', { title: 'Not Found' });
    res.render('profile/user-profile', {
      title: profile.username,
      profile,
      listings: profile.listings || [],
      posts: profile.posts || [],
      isFollowing: profile.isFollowing || false,
    });
  } catch (e) { next(e); }
});

webRouter.post('/u/:username/follow', requireAuth, async (req, res, next) => {
  try {
    await userService.followUser(req.user.id, req.params.username);
    res.redirect(`/u/${req.params.username}`);
  } catch (e) { next(e); }
});

// Settings
webRouter.get('/settings', requireAuth, async (req, res) => {
  res.render('profile/settings', {
    title: res.locals.t('settings.title'),
    success: req.query.saved === '1' ? true : false,
  });
});

webRouter.post('/settings', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const { storeOneFile: storeFile } = require('../utils/upload');
    const avatar = req.file ? await storeFile(req.file) : undefined;
    await userService.updateMyProfile(req.user.id, {
      bio: req.body.bio,
      avatar,
    });
    res.redirect('/settings?saved=1');
  } catch (e) {
    res.render('profile/settings', {
      title: res.locals.t('settings.title'),
      error: e.message,
    });
  }
});

// API
apiRouter.get('/:username', async (req, res) => {
  const profile = await userService.getUserProfileByUsername(req.params.username, req.user?.id);
  if (!profile) return res.status(404).json({ error: 'User not found' });
  res.json({ profile });
});

apiRouter.patch('/me', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const avatar = req.file ? await storeOneFile(req.file) : undefined;
    let pcSpecs = undefined;
    if (req.body.cpu || req.body.gpu || req.body.ram || req.body.storage) {
      pcSpecs = { cpu: req.body.cpu, gpu: req.body.gpu, ram: req.body.ram, storage: req.body.storage };
    }
    const user = await userService.updateMyProfile(req.user.id, { bio: req.body.bio, avatar, pcSpecs });
    res.json({ user });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = { webRouter, apiRouter };
