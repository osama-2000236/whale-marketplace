const prisma = require('../lib/prisma');
const { parseLimit, createCursorResponse } = require('../utils/pagination');

async function listRooms({ search, userId, cursor, limit = 24 } = {}) {
  const take = parseLimit(limit, 24, 60);

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search, mode: 'insensitive' } },
          { game: { contains: search, mode: 'insensitive' } }
        ]
      }
    : {};

  const rooms = await prisma.gameRoom.findMany({
    where,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ isOfficial: 'desc' }, { memberCount: 'desc' }, { createdAt: 'desc' }],
    take: take + 1
  });

  const paginated = createCursorResponse(rooms, take);

  let joinedRoomIds = new Set();
  let yourRooms = [];

  if (userId) {
    const memberships = await prisma.roomMembership.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { joinedAt: 'desc' },
      take: 10
    });

    joinedRoomIds = new Set(memberships.map((m) => m.roomId));
    yourRooms = memberships.map((m) => m.room);
  }

  return {
    ...paginated,
    items: paginated.items.map((room) => ({
      ...room,
      joined: joinedRoomIds.has(room.id)
    })),
    yourRooms
  };
}

async function getRoomBySlug(slug, userId) {
  const room = await prisma.gameRoom.findUnique({
    where: { slug },
    include: {
      members: {
        where: {
          role: 'MODERATOR'
        },
        include: {
          user: {
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

  if (!room) return null;

  let joined = false;
  if (userId) {
    const membership = await prisma.roomMembership.findUnique({
      where: {
        userId_roomId: {
          userId,
          roomId: room.id
        }
      }
    });
    joined = Boolean(membership);
  }

  return {
    ...room,
    joined,
    moderators: room.members.map((m) => m.user)
  };
}

async function toggleRoomMembership({ userId, slug }) {
  const room = await prisma.gameRoom.findUnique({ where: { slug } });
  if (!room) throw new Error('Room not found');

  return prisma.$transaction(async (tx) => {
    const membership = await tx.roomMembership.findUnique({
      where: {
        userId_roomId: {
          userId,
          roomId: room.id
        }
      }
    });

    if (membership) {
      await tx.roomMembership.delete({
        where: {
          userId_roomId: {
            userId,
            roomId: room.id
          }
        }
      });

      await tx.gameRoom.update({
        where: { id: room.id },
        data: { memberCount: { decrement: 1 } }
      });

      return { joined: false, roomId: room.id };
    }

    await tx.roomMembership.create({
      data: {
        userId,
        roomId: room.id,
        role: 'MEMBER'
      }
    });

    await tx.gameRoom.update({
      where: { id: room.id },
      data: { memberCount: { increment: 1 } }
    });

    return { joined: true, roomId: room.id };
  });
}

module.exports = {
  listRooms,
  getRoomBySlug,
  toggleRoomMembership
};
