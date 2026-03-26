const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
const prisma = require('./prisma');
const bcrypt = require('bcrypt');
const userService = require('../services/userService');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: { subscription: true, sellerProfile: true },
    });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Local strategy — login with email or username
passport.use(
  new LocalStrategy(
    { usernameField: 'identifier', passwordField: 'password' },
    async (identifier, password, done) => {
      try {
        const user = await prisma.user.findFirst({
          where: {
            deletedAt: null,
            OR: [{ email: identifier.toLowerCase().trim() }, { username: identifier.trim() }],
          },
        });
        if (!user) return done(null, false, { message: 'USER_NOT_FOUND' });
        if (user.isBanned) return done(null, false, { message: 'USER_BANNED' });
        if (!user.passwordHash) return done(null, false, { message: 'OAUTH_ONLY' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return done(null, false, { message: 'WRONG_PASSWORD' });

        await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Google OAuth (only if credentials are configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: (process.env.BASE_URL || 'http://localhost:3000') + '/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const { user } = await findOrCreateOAuthUser({
            provider: 'google',
            providerId: profile.id,
            email: profile.emails?.[0]?.value,
            displayName: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
} else {
  console.log('Google OAuth strategy skipped: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set');
}

// Helper: find or create OAuth user (delegates to userService)
async function findOrCreateOAuthUser({ provider, providerId, email, displayName, avatarUrl }) {
  const profile = {
    emails: email ? [{ value: email }] : [],
    displayName,
    photos: avatarUrl ? [{ value: avatarUrl }] : [],
  };
  return userService.findOrCreateOAuth(provider, providerId, profile);
}

// Facebook OAuth (only if credentials are configured)
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: (process.env.BASE_URL || 'http://localhost:3000') + '/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'emails', 'photos'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const { user } = await findOrCreateOAuthUser({
            provider: 'facebook',
            providerId: profile.id,
            email,
            displayName: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
} else {
  console.log('Facebook OAuth strategy skipped: FACEBOOK_APP_ID or FACEBOOK_APP_SECRET not set');
}

// Apple Sign In
if (
  process.env.APPLE_SERVICE_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_PRIVATE_KEY
) {
  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_SERVICE_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKeyString: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        callbackURL: (process.env.BASE_URL || 'http://localhost:3000') + '/auth/apple/callback',
        scope: ['name', 'email'],
      },
      async (req, accessToken, refreshToken, idToken, profile, done) => {
        try {
          const email = profile.email || idToken?.email;
          const displayName = profile.name
            ? `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim()
            : null;
          const { user } = await findOrCreateOAuthUser({
            provider: 'apple',
            providerId: profile.id || idToken?.sub,
            email,
            displayName,
            avatarUrl: null,
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
} else {
  console.log('Apple Sign In strategy skipped: APPLE_SERVICE_ID, APPLE_TEAM_ID, APPLE_KEY_ID, or APPLE_PRIVATE_KEY not set');
}

module.exports = passport;
