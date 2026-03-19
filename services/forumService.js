const prisma = require('../lib/prisma');
const slugifyLib = require('slugify');
const { v4: uuidv4 } = require('uuid');

function makeSlug(title) {
  const base = slugifyLib(title, { lower: true, strict: true }) || 'thread';
  return `${base}-${uuidv4().slice(0, 6)}`;
}

async function getCategories() {
  return prisma.forumCategory.findMany({
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { threads: true } },
      threads: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { author: { select: { id: true, username: true, avatar: true } } },
      },
    },
  });
}

async function getThreadsByCategory(slug, cursor = null, take = 20) {
  const category = await prisma.forumCategory.findUnique({ where: { slug } });
  if (!category) return null;

  const query = {
    where: { categoryId: category.id },
    orderBy: [{ isPinned: 'desc' }, { lastReplyAt: 'desc' }, { createdAt: 'desc' }],
    take: take + 1,
    include: {
      author: { select: { id: true, username: true, avatar: true, reputationPoints: true } },
      _count: { select: { replies: true } },
    },
  };
  if (cursor) { query.cursor = { id: cursor }; query.skip = 1; }

  const items = await prisma.forumThread.findMany(query);
  const hasMore = items.length > take;
  const threads = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore ? threads[threads.length - 1].id : null;

  return { category, threads, hasMore, nextCursor };
}

async function getThread(slug) {
  const thread = await prisma.forumThread.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, username: true, avatar: true, reputationPoints: true } },
      category: true,
      replies: {
        where: { parentId: null },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, username: true, avatar: true, reputationPoints: true } },
          children: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, username: true, avatar: true, reputationPoints: true } } },
          },
        },
      },
    },
  });
  return thread;
}

async function createThread(authorId, categoryId, { title, body, tags }) {
  const slug = makeSlug(title);
  return prisma.forumThread.create({
    data: {
      title, slug, body,
      authorId, categoryId,
      tags: tags || [],
      lastReplyAt: new Date(),
    },
  });
}

async function createReply(authorId, threadId, { body, parentId }) {
  return prisma.$transaction(async (tx) => {
    const reply = await tx.forumReply.create({
      data: { body, authorId, threadId, parentId: parentId || null },
    });
    await tx.forumThread.update({
      where: { id: threadId },
      data: { replyCount: { increment: 1 }, lastReplyAt: new Date() },
    });
    return reply;
  });
}

async function incrementThreadViews(threadId) {
  await prisma.forumThread.update({ where: { id: threadId }, data: { views: { increment: 1 } } }).catch(() => {});
}

async function toggleReplyLike(replyId, userId) {
  const reply = await prisma.forumReply.findUnique({ where: { id: replyId } });
  if (!reply) throw new Error('Reply not found');

  const likedBy = reply.likedBy || [];
  const isLiked = likedBy.includes(userId);

  const newLikedBy = isLiked ? likedBy.filter((id) => id !== userId) : [...likedBy, userId];
  const updated = await prisma.forumReply.update({
    where: { id: replyId },
    data: { likedBy: newLikedBy, likesCount: isLiked ? { decrement: 1 } : { increment: 1 } },
  });

  return { likesCount: updated.likesCount, likedBy: updated.likedBy };
}

async function acceptReply(replyId, requestingUserId) {
  const reply = await prisma.forumReply.findUnique({
    where: { id: replyId },
    include: { thread: true },
  });
  if (!reply) return { error: 'Reply not found' };
  if (reply.thread.authorId !== requestingUserId) return { error: 'Only the thread author can accept' };

  await prisma.$transaction(async (tx) => {
    // Unmark previous accepted reply
    await tx.forumReply.updateMany({
      where: { threadId: reply.threadId, isAccepted: true },
      data: { isAccepted: false },
    });
    await tx.forumReply.update({ where: { id: replyId }, data: { isAccepted: true } });
    await tx.forumThread.update({ where: { id: reply.threadId }, data: { isSolved: true } });
    // Award reputation
    await tx.user.update({
      where: { id: reply.authorId },
      data: { reputationPoints: { increment: 2 } },
    });
  });

  return { ok: true };
}

module.exports = {
  getCategories, getThreadsByCategory, getThread,
  createThread, createReply, incrementThreadViews,
  toggleReplyLike, acceptReply,
};
