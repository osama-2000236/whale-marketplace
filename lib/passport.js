const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
const prisma = require('./prisma');
const bcrypt = require('bcrypt');

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
          const email = profile.emails?.[0]?.value;
          if (!email) return done(null, false, { message: 'NO_EMAIL' });

          // Check if user exists by googleId
          let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
          if (user) {
            await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
            return done(null, user);
          }

          // Check if email already exists — link accounts
          user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
          if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id, lastSeenAt: new Date() },
            });
            return done(null, user);
          }

          // Brand new user
          const username =
            (profile.displayName || email.split('@')[0])
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '')
              .slice(0, 30) || 'user_' + Date.now();
          const slug = username;

          // Ensure unique username
          let finalUsername = username;
          let counter = 1;
          while (await prisma.user.findUnique({ where: { username: finalUsername } })) {
            finalUsername = username.slice(0, 27) + '_' + counter++;
          }
          let finalSlug = finalUsername;
          while (await prisma.user.findUnique({ where: { slug: finalSlug } })) {
            finalSlug = finalUsername + '-' + counter++;
          }

          user = await prisma.user.create({
            data: {
              username: finalUsername,
              slug: finalSlug,
              email: email.toLowerCase(),
              googleId: profile.id,
              avatarUrl: profile.photos?.[0]?.value || null,
              isVerified: true,
              subscription: {
                create: {
                  plan: 'free',
                  trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              },
              sellerProfile: {
                create: { displayName: profile.displayName || finalUsername },
              },
            },
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

// Helper: find or create OAuth user
async function findOrCreateOAuthUser({ provider, providerId, email, displayName, avatarUrl }) {
  const idField = `${provider}Id`; // googleId, facebookId, appleId

  // Check if user exists by provider ID
  let user = await prisma.user.findUnique({ where: { [idField]: providerId } });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    return user;
  }

  // Check if email already exists — link accounts
  if (email) {
    user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { [idField]: providerId, lastSeenAt: new Date() },
      });
      return user;
    }
  }

  // Brand new user
  const username =
    (displayName || (email ? email.split('@')[0] : ''))
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 30) || 'user_' + Date.now();

  let finalUsername = username;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { username: finalUsername } })) {
    finalUsername = username.slice(0, 27) + '_' + counter++;
  }
  let finalSlug = finalUsername;
  while (await prisma.user.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = finalUsername + '-' + counter++;
  }

  user = await prisma.user.create({
    data: {
      username: finalUsername,
      slug: finalSlug,
      email: email ? email.toLowerCase() : `${providerId}@${provider}.oauth`,
      [idField]: providerId,
      avatarUrl: avatarUrl || null,
      isVerified: true,
      subscription: {
        create: { plan: 'free', trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      sellerProfile: {
        create: { displayName: displayName || finalUsername },
      },
    },
  });
  return user;
}

// Facebook OAuth
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
          const user = await findOrCreateOAuthUser({
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
          const user = await findOrCreateOAuthUser({
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
}

module.exports = passport;
