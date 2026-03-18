'use strict';

const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const AppleStrategy = require('passport-apple');
const prisma = require('./prisma');

function providerField(provider) {
  return {
    google: 'googleId',
    facebook: 'facebookId',
    apple: 'appleId'
  }[provider];
}

function hasEnv(keys) {
  return keys.every((k) => Boolean(process.env[k]));
}

function makeBaseUsername(provider, email, displayName) {
  const source = (displayName || email?.split('@')[0] || `${provider}_user`).toLowerCase();
  const sanitized = source.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return (sanitized || `${provider}_user`).slice(0, 20);
}

async function uniqueUsername(base) {
  let candidate = base;
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base.slice(0, Math.max(1, 20 - String(i).length))}${i}`;
    i += 1;
  }
  return candidate;
}

async function findOrCreateOAuthUser(provider, providerId, profile) {
  const field = providerField(provider);
  if (!field || !providerId) throw new Error('Invalid OAuth payload');

  const emailRaw = profile?.emails?.[0]?.value || null;
  const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;
  const displayName = profile?.displayName || profile?.name?.givenName || null;
  const avatar = profile?.photos?.[0]?.value || null;

  const byProvider = await prisma.user.findFirst({
    where: { [field]: String(providerId) }
  });
  if (byProvider) return byProvider;

  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: {
          [field]: String(providerId),
          oauthProvider: provider,
          emailVerified: true,
          ...(avatar && !byEmail.avatar ? { avatar } : {}),
          ...(avatar && !byEmail.avatarUrl ? { avatarUrl: avatar } : {})
        }
      });
    }
  }

  const base = makeBaseUsername(provider, email, displayName);
  const username = await uniqueUsername(base);
  const passwordHash = await bcrypt.hash(uuidv4(), 12);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        email: email || `${provider}_${providerId}@whale.oauth`,
        passwordHash,
        role: 'MEMBER',
        [field]: String(providerId),
        oauthProvider: provider,
        emailVerified: Boolean(email),
        avatar: avatar || null,
        avatarUrl: avatar || null
      }
    });

    await tx.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: 'pro',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      update: {}
    });

    await tx.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        message: `🐳 مرحباً ${username}! حسابك جاهز — 30 يوم Pro مجاناً. / Welcome! Your account is ready — 30 days Pro free.`
      }
    });

    return user;
  });
}

if (hasEnv(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OAUTH_CALLBACK_BASE'])) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.OAUTH_CALLBACK_BASE}/auth/google/callback`,
    scope: ['profile', 'email'],
    state: true
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const user = await findOrCreateOAuthUser('google', profile.id, profile);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  // eslint-disable-next-line no-console
  console.warn('[OAuth] Google strategy disabled: missing env vars');
}

if (hasEnv(['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'OAUTH_CALLBACK_BASE'])) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${process.env.OAUTH_CALLBACK_BASE}/auth/facebook/callback`,
    profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
    state: true
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const user = await findOrCreateOAuthUser('facebook', profile.id, profile);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  // eslint-disable-next-line no-console
  console.warn('[OAuth] Facebook strategy disabled: missing env vars');
}

if (hasEnv(['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY_PATH', 'OAUTH_CALLBACK_BASE'])
  && fs.existsSync(process.env.APPLE_PRIVATE_KEY_PATH)) {
  passport.use(new AppleStrategy({
    clientID: process.env.APPLE_CLIENT_ID,
    teamID: process.env.APPLE_TEAM_ID,
    keyID: process.env.APPLE_KEY_ID,
    privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH,
    callbackURL: `${process.env.OAUTH_CALLBACK_BASE}/auth/apple/callback`,
    passReqToCallback: true
  }, async (req, _accessToken, _refreshToken, idToken, _profile, done) => {
    try {
      const decoded = idToken ? jwt.decode(idToken) : null;
      const appleUser = req.appleProfile || {};
      const firstName = appleUser?.name?.firstName || '';
      const lastName = appleUser?.name?.lastName || '';
      const email = appleUser?.email || decoded?.email || null;
      const providerId = decoded?.sub;

      if (!providerId) {
        return done(new Error('Apple OAuth missing sub'), null);
      }

      const syntheticProfile = {
        displayName: `${firstName} ${lastName}`.trim() || null,
        emails: email ? [{ value: email }] : [],
        photos: []
      };

      const user = await findOrCreateOAuthUser('apple', providerId, syntheticProfile);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));
} else {
  // eslint-disable-next-line no-console
  console.warn('[OAuth] Apple strategy disabled: missing env vars/key file');
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
});

module.exports = passport;
module.exports.findOrCreateOAuthUser = findOrCreateOAuthUser;
