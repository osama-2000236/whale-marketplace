const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const userService = require('../services/userService');
const { sanitizeBody } = require('../utils/sanitize');
const { upload, uploadToCloud } = require('../utils/images');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.username, req.user.id);
    res.render('profile/index', { title: res.locals.t('profile.title'), profile });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, upload.single('avatar'), async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body, {
      displayName: 100,
      bio: 500,
      city: 100,
      whatsapp: 20,
    });

    if (req.file) {
      data.avatarUrl = await uploadToCloud(req.file);
    }

    await userService.updateProfile(req.user.id, data);
    req.session.flash = { type: 'success', message: res.locals.t('flash.profile_updated') };
    res.redirect('/profile');
  } catch (err) {
    req.session.flash = { type: 'danger', message: err.message };
    res.redirect('/profile');
  }
});

module.exports = router;
