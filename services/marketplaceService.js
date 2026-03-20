const prisma = require('../lib/prisma');

async function updateListing(listingId, data) {
  return prisma.marketplaceListing.update({
    where: { id: listingId },
    data,
  });
}

module.exports = { updateListing };
