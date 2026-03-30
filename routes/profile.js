const router = require('express').Router();
const { requireAuth, requireVerified } = require('../middleware/auth');
const userService = require('../services/userService');
const { sanitizeBody } = require('../utils/sanitize');
const { upload, uploadToCloud } = require('../utils/images');

function getProfileMessage(code) {
  return (
    {
      INVALID_DISPLAY_NAME: 'Display name must be between 2 and 100 characters.',
      INVALID_BIO: 'Bio must be 500 characters or fewer.',
      INVALID_CITY: 'Please enter a valid city.',
      INVALID_WHATSAPP: 'Please enter a valid WhatsApp number.',
      INVALID_PHONE: 'Please enter a valid phone number.',
      INVALID_STREET: 'Please enter a valid street address.',
      ADDRESS_NOT_FOUND: 'We could not find that address.',
      INVALID_USERNAME: 'Username must be 3-30 characters using letters, numbers, or underscore.',
      USERNAME_TAKEN: 'That username is already taken.',
      USERNAME_UNCHANGED: 'Your username is already set to that value.',
      INVALID_EMAIL: 'Please enter a valid email address.',
      EMAIL_TAKEN: 'That email is already in use.',
      EMAIL_UNCHANGED: 'Your email is already set to that address.',
      CURRENT_PASSWORD_REQUIRED: 'Please enter your current password.',
      CURRENT_PASSWORD_INVALID: 'Your current password is incorrect.',
      PASSWORD_SETUP_REQUIRED:
        'Set a password from the email we just sent before changing account settings.',
      WEAK_PASSWORD: 'Password must be at least 8 characters long.',
      PASSWORD_MISMATCH: 'Passwords do not match.',
      PASSWORD_UNCHANGED: 'Choose a new password instead of reusing the current one.',
    }[code] || code || 'Something went wrong.'
  );
}

function getProfileFlashType(code) {
  return code === 'PASSWORD_SETUP_REQUIRED' ? 'info' : 'danger';
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const profile = await userService.getAccountProfile(req.user.id);
    res.render('profile/index', {
      title: res.locals.t('profile.title'),
      profile,
      addresses: profile.addresses || [],
      hasLocalPassword: Boolean(profile.passwordHash),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const data = sanitizeBody(req.body, {
      displayName: 100,
      bio: 500,
      city: 100,
      whatsapp: 25,
    });

    if (req.file) {
      data.avatarUrl = await uploadToCloud(req.file);
    }

    await userService.updateProfile(req.user.id, data);
    req.session.flash = { type: 'success', message: res.locals.t('flash.profile_updated') };
  } catch (err) {
    req.session.flash = { type: getProfileFlashType(err.message), message: getProfileMessage(err.message) };
  }

  return res.redirect('/profile');
});

router.post('/account/username', requireAuth, requireVerified, async (req, res) => {
  try {
    const data = sanitizeBody(req.body, {
      username: 30,
      currentPassword: 128,
    });
    await userService.changeUsername(req.user.id, data);
    req.session.flash = {
      type: 'success',
      message: 'Your username was updated successfully.',
    };
  } catch (err) {
    req.session.flash = { type: getProfileFlashType(err.message), message: getProfileMessage(err.message) };
  }

  return res.redirect('/profile');
});

router.post('/account/email', requireAuth, requireVerified, async (req, res) => {
  try {
    const data = sanitizeBody(req.body, {
      email: 255,
      currentPassword: 128,
    });
    await userService.requestEmailChange(req.user.id, data);
    req.session.flash = {
      type: 'success',
      message: 'Check your new email inbox to confirm the change.',
    };
  } catch (err) {
    req.session.flash = { type: getProfileFlashType(err.message), message: getProfileMessage(err.message) };
  }

  return res.redirect('/profile');
});

router.post('/account/password', requireAuth, requireVerified, async (req, res) => {
  try {
    const data = sanitizeBody(req.body, {
      currentPassword: 128,
      newPassword: 128,
      confirmPassword: 128,
    });
    await userService.changePassword(req.user.id, data);
    req.session.flash = {
      type: 'success',
      message: 'Your password was updated successfully.',
    };
  } catch (err) {
    req.session.flash = { type: getProfileFlashType(err.message), message: getProfileMessage(err.message) };
  }

  return res.redirect('/profile');
});

router.post('/addresses', requireAuth, async (req, res) => {
  try {
    const data = sanitizeBody(req.body, {
      label: 50,
      street: 200,
      city: 100,
      phone: 25,
    });
    data.isDefault = req.body.isDefault;
    await userService.createAddress(req.user.id, data);
    req.session.flash = { type: 'success', message: 'Address saved successfully.' };
  } catch (err) {
    req.session.flash = { type: 'danger', message: getProfileMessage(err.message) };
  }

  return res.redirect('/profile');
});

router.post('/addresses/:id', requireAuth, async (req, res) => {
  try {
    const data = sanitizeBody(req.body, {
      label: 50,
      street: 200,
      city: 100,
      phone: 25,
    });
    data.isDefault = req.body.isDefault;
    await userService.updateAddress(req.user.id, req.params.id, data);
    req.session.flash = { type: 'success', message: 'Address updated successfully.' };
  } catch (err) {
    req.session.flash = { type: 'danger', message: getProfileMessage(err.message) };
  }

  return res.redirect('/profile');
});

router.post('/addresses/:id/delete', requireAuth, async (req, res) => {
  try {
    await userService.deleteAddress(req.user.id, req.params.id);
    req.session.flash = { type: 'success', message: 'Address removed successfully.' };
  } catch (err) {
    req.session.flash = { type: 'danger', message: getProfileMessage(err.message) };
  }

  return res.redirect('/profile');
});

module.exports = router;
