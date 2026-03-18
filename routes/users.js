const express = require('express');

const { requireAuth, optionalAuth } = require('../middleware/auth');
const {
  getUserProfileByUsername,
  updateMyProfile,
  followUser
} = require('../services/userService');
const { upload, storeOneFile } = require('../utils/upload');

const webRouter = express.Router();
const apiRouter = express.Router();

function parsePcSpecs(body = {}) {
  if (body.pcSpecs && typeof body.pcSpecs === 'object') {
    return body.pcSpecs;
  }

  if (body.pcSpecs && typeof body.pcSpecs === 'string') {
    try {
      return JSON.parse(body.pcSpecs);
    } catch (_error) {
      // ignore malformed JSON and fallback to fields
    }
  }

  const pcSpecs = {
    cpu: body.cpu,
    gpu: body.gpu,
    ram: body.ram,
    storage: body.storage
  };

  const hasAny = Object.values(pcSpecs).some(Boolean);
  return hasAny ? pcSpecs : undefined;
}

webRouter.get('/u/:username', optionalAuth, async (req, res, next) => {
  try {
    const profile = await getUserProfileByUsername(req.params.username, req.user?.id, {
      limit: 12
    });

    if (!profile) {
      return res.status(404).render('404', { title: 'المستخدم غير موجود | User not found' });
    }

    return res.render('profile/user-profile', {
      title: `${profile.username} | الملف الشخصي Profile`,
      profile,
      tab: req.query.tab || 'posts'
    });
  } catch (error) {
    return next(error);
  }
});

webRouter.post('/u/:username/follow', requireAuth, async (req, res) => {
  try {
    await followUser(req.user.id, req.params.username);
    return res.redirect(`/u/${req.params.username}`);
  } catch (error) {
    return res.status(400).render('error', {
      title: 'خطأ | Error',
      message: error.message
    });
  }
});

apiRouter.get('/:username', optionalAuth, async (req, res) => {
  try {
    const profile = await getUserProfileByUsername(req.params.username, req.user?.id, {
      limit: Number(req.query.limit) || 10
    });

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: profile });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

apiRouter.patch('/me', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const avatar = req.file ? await storeOneFile(req.file, 'uploads/avatars') : undefined;

    const updated = await updateMyProfile(req.user.id, {
      bio: req.body.bio,
      avatar,
      pcSpecs: parsePcSpecs(req.body)
    });

    return res.json({ user: updated });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = {
  webRouter,
  apiRouter
};
