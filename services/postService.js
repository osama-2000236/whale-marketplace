const prisma = require('../lib/prisma');
const { parseLimit, createCursorResponse } = require('../utils/pagination');

async function createPost({ authorId, content, images = [], roomId = null, type = 'UPDATE' }) {
  if (!authorId) throw new Error('Authentication required');
  if (!String(content || '').trim()) throw new Error('Post content is required');

  const post = await prisma.post.create({
    data: {
      authorId,
      content: String(content).trim(),
      images: Array.isArray(images) ? images.slice(0, 4) : [],
      roomId: roomId || null,
      type
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
          role: true
        }
      },
      room: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true
        }
      }
    }
  });

  return post;
}

async function getPostById(postId, viewerId = null) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
          role: true
        }
      },
      room: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true
        }
      }
    }
  });

  if (!post) return null;

  if (!viewerId) {
    return {
      ...post,
      viewerLiked: false
    };
  }

  const like = await prisma.like.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: viewerId,
        targetType: 'POST',
        targetId: post.id
      }
    }
  });

  return {
    ...post,
    viewerLiked: Boolean(like)
  };
}

async function listFeed({ userId, cursor, limit = 10 }) {
  const take = parseLimit(limit, 10, 30);

  let where = {};

  if (userId) {
    const [memberships, following] = await Promise.all([
      prisma.roomMembership.findMany({
        where: { userId },
        select: { roomId: true }
      }),
      prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true }
      })
    ]);

    const roomIds = memberships.map((row) => row.roomId);
    const followingIds = following.map((row) => row.followingId);

    where = {
      OR: [
        roomIds.length ? { roomId: { in: roomIds } } : undefined,
        followingIds.length ? { authorId: { in: followingIds } } : undefined,
        { authorId: userId }
      ].filter(Boolean)
    };
  }

  const posts = await prisma.post.findMany({
    where,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
          role: true
        }
      },
      room: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true
        }
      }
    }
  });

  let likedSet = new Set();
  if (userId && posts.length) {
    const likes = await prisma.like.findMany({
      where: {
        userId,
        targetType: 'POST',
        targetId: {
          in: posts.map((item) => item.id)
        }
      },
      select: {
        targetId: true
      }
    });
    likedSet = new Set(likes.map((item) => item.targetId));
  }

  const hydrated = posts.map((post) => ({
    ...post,
    viewerLiked: likedSet.has(post.id)
  }));

  return createCursorResponse(hydrated, take);
}

async function listRoomPosts({ roomId, cursor, limit = 10 }) {
  const take = parseLimit(limit, 10, 30);

  const posts = await prisma.post.findMany({
    where: { roomId },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
          role: true
        }
      }
    }
  });

  return createCursorResponse(posts, take);
}

function canModerate(user) {
  return Boolean(user && ['ADMIN', 'MODERATOR'].includes(user.role));
}

async function deletePost({ postId, actor }) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Post not found');

  const allowed = actor && (actor.id === post.authorId || canModerate(actor));
  if (!allowed) throw new Error('Not allowed');

  await prisma.$transaction(async (tx) => {
    await tx.comment.deleteMany({ where: { postId } });
    await tx.like.deleteMany({
      where: {
        targetType: 'POST',
        targetId: postId
      }
    });
    await tx.post.delete({ where: { id: postId } });
  });

  return true;
}

async function togglePostLike({ userId, postId }) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true }
  });
  if (!post) throw new Error('Post not found');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: 'POST',
          targetId: postId
        }
      }
    });

    if (existing) {
      await tx.like.delete({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: 'POST',
            targetId: postId
          }
        }
      });

      await tx.post.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } }
      });

      return { liked: false };
    }

    await tx.like.create({
      data: {
        userId,
        targetType: 'POST',
        targetId: postId
      }
    });

    await tx.post.update({
      where: { id: postId },
      data: { likesCount: { increment: 1 } }
    });

    if (post.authorId !== userId) {
      await tx.notification.create({
        data: {
          userId: post.authorId,
          type: 'LIKE',
          referenceId: postId,
          referenceType: 'post'
        }
      });
    }

    return { liked: true };
  });
}

async function listComments(postId, { cursor, limit = 10 } = {}) {
  const take = parseLimit(limit, 10, 30);

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      parentCommentId: null
    },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
          role: true
        }
      },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatar: true,
              role: true
            }
          }
        }
      }
    }
  });

  return createCursorResponse(comments, take);
}

async function createComment({ authorId, postId, content, parentCommentId = null }) {
  if (!authorId || !postId || !String(content || '').trim()) {
    throw new Error('Invalid comment payload');
  }

  if (parentCommentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentCommentId },
      select: { id: true, parentCommentId: true, postId: true }
    });

    if (!parent) {
      throw new Error('Parent comment not found');
    }

    if (parent.parentCommentId) {
      throw new Error('Only one reply level is allowed');
    }

    if (parent.postId !== postId) {
      throw new Error('Reply must be in the same post');
    }
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        authorId,
        postId,
        content: String(content).trim(),
        parentCommentId
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
            role: true
          }
        }
      }
    });

    const post = await tx.post.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
      select: { authorId: true }
    });

    if (post.authorId !== authorId) {
      await tx.notification.create({
        data: {
          userId: post.authorId,
          type: 'COMMENT',
          referenceId: postId,
          referenceType: 'post'
        }
      });
    }

    return created;
  });

  return comment;
}

async function deleteComment({ commentId, actor }) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true }
  });

  if (!comment) throw new Error('Comment not found');

  const allowed = actor && (actor.id === comment.authorId || canModerate(actor));
  if (!allowed) throw new Error('Not allowed');

  await prisma.$transaction(async (tx) => {
    await tx.comment.deleteMany({
      where: {
        OR: [{ id: commentId }, { parentCommentId: commentId }]
      }
    });

    await tx.like.deleteMany({
      where: {
        targetType: 'COMMENT',
        targetId: commentId
      }
    });

    await tx.post.update({
      where: { id: comment.postId },
      data: { commentsCount: { decrement: 1 } }
    });
  });

  return true;
}

async function toggleCommentLike({ userId, commentId }) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true }
  });
  if (!comment) throw new Error('Comment not found');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: 'COMMENT',
          targetId: commentId
        }
      }
    });

    if (existing) {
      await tx.like.delete({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType: 'COMMENT',
            targetId: commentId
          }
        }
      });

      await tx.comment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } }
      });

      return { liked: false };
    }

    await tx.like.create({
      data: {
        userId,
        targetType: 'COMMENT',
        targetId: commentId
      }
    });

    await tx.comment.update({
      where: { id: commentId },
      data: { likesCount: { increment: 1 } }
    });

    if (comment.authorId !== userId) {
      await tx.notification.create({
        data: {
          userId: comment.authorId,
          type: 'LIKE',
          referenceId: commentId,
          referenceType: 'comment'
        }
      });
    }

    return { liked: true };
  });
}

module.exports = {
  createPost,
  getPostById,
  listFeed,
  listRoomPosts,
  deletePost,
  togglePostLike,
  listComments,
  createComment,
  deleteComment,
  toggleCommentLike,
  canModerate
};
