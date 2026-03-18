const prisma = require('../lib/prisma');
const slugify = require('slugify');
const { v4: uuidv4 } = require('uuid');

function makeSlug(title) {
  const base = slugify(title, { lower: true, strict: true, locale: 'ar' });
  return `${base}-${uuidv4().slice(0, 6)}`;
}

async function getCategories() {
  return prisma.forumCategory.findMany({
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { threads: true } },
      threads: {
        orderBy: { lastReplyAt: 'desc' },
        take: 1,
        include: { author: { select: { username: true, avatar: true } } }
      }
    }
  });
}

async function getThreadsByCategory(slug, cursor = null, take = 20) {
  const category = await prisma.forumCategory.findUnique({ where: { slug } });
  if (!category) return null;

  const where = { categoryId: category.id };
  const threads = await prisma.forumThread.findMany({
    where,
    orderBy: [{ isPinned: 'desc' }, { lastReplyAt: 'desc' }, { createdAt: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      author: { select: { username: true, avatar: true } },
      _count: { select: { replies: true } }
    }
  });

  const hasMore = threads.length > take;
  return {
    category,
    threads: threads.slice(0, take),
    hasMore,
    nextCursor: hasMore ? threads[take - 1].id : null
  };
}

async function getThread(slug) {
  return prisma.forumThread.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, username: true, avatar: true, createdAt: true, reputationPoints: true } },
      category: true,
      replies: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, username: true, avatar: true, createdAt: true, reputationPoints: true } },
          children: {
            include: {
              author: { select: { id: true, username: true, avatar: true, reputationPoints: true } }
            }
          }
        },
        where: { parentId: null }
      }
    }
  });
}

async function createThread(authorId, categoryId, { title, body, tags }) {
  const slug = makeSlug(title);
  return prisma.forumThread.create({
    data: {
      title,
      slug,
      body,
      authorId,
      categoryId,
      tags: tags || [],
      lastReplyAt: new Date()
    }
  });
}

async function createReply(authorId, threadId, { body, parentId }) {
  const reply = await prisma.$transaction(async (tx) => {
    const created = await tx.forumReply.create({
      data: { body, authorId, threadId, parentId: parentId || null }
    });

    await tx.forumThread.update({
      where: { id: threadId },
      data: { replyCount: { increment: 1 }, lastReplyAt: new Date() }
    });

    return created;
  });

  return reply;
}

async function incrementThreadViews(threadId) {
  await prisma.forumThread.update({
    where: { id: threadId },
    data: { views: { increment: 1 } }
  });
}

async function toggleReplyLike(replyId, userId) {
  const reply = await prisma.forumReply.findUnique({ where: { id: replyId } });
  if (!reply) return null;

  const likedBy = Array.isArray(reply.likedBy) ? reply.likedBy : [];
  const liked = likedBy.includes(userId);

  return prisma.forumReply.update({
    where: { id: replyId },
    data: {
      likesCount: liked ? Math.max(0, reply.likesCount - 1) : reply.likesCount + 1,
      likedBy: liked ? likedBy.filter((id) => id !== userId) : [...likedBy, userId]
    }
  });
}

async function acceptReply(replyId, requestingUserId) {
  const reply = await prisma.forumReply.findUnique({
    where: { id: replyId },
    include: { thread: true }
  });

  if (!reply) return { error: 'not_found' };
  if (reply.thread.authorId !== requestingUserId) return { error: 'not_authorized' };

  return prisma.$transaction(async (tx) => {
    await tx.forumReply.updateMany({
      where: { threadId: reply.threadId, isAccepted: true },
      data: { isAccepted: false }
    });

    await tx.forumReply.update({ where: { id: replyId }, data: { isAccepted: true } });
    await tx.forumThread.update({ where: { id: reply.threadId }, data: { isSolved: true } });

    await tx.user.update({
      where: { id: reply.authorId },
      data: { reputationPoints: { increment: 2 } }
    });

    return { ok: true };
  });
}

module.exports = {
  getCategories,
  getThreadsByCategory,
  getThread,
  createThread,
  createReply,
  incrementThreadViews,
  toggleReplyLike,
  acceptReply
};
