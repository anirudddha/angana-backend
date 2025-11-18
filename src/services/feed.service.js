import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Combined user feed of posts + local deals
 */
export const getUserFeed = async (userId, page = 1, limit = 10) => {
  console.log("📥 Fetching feed for user:", userId);

  // 1️⃣ Find all neighborhoods the user is part of
  const memberships = await prisma.neighborhoodMembership.findMany({
    where: { user_id: userId },
    select: { neighborhood_id: true },
  });

  if (!memberships || memberships.length === 0) {
    console.log("⚠️ No neighborhood memberships found for user.");
    return [];
  }

  const neighborhoodIds = memberships.map(m => m.neighborhood_id);
  console.log("🏘 Neighborhoods:", neighborhoodIds);

  // 2️⃣ Fetch posts in those neighborhoods
  const posts = await prisma.post.findMany({
    where: { neighborhood_id: { in: neighborhoodIds } },
    include: {
      author: {
        select: {
          full_name: true,
          avatar_url: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
      media: {
        select: {
          id: true,
          url: true,
        },
      },
      categories: true, // Include categories
      poll: { // Include poll details
        include: {
          options: {
            include: {
              _count: { select: { votes: true } }
            }
          }
        }
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const postIds = posts.map(p => p.id);
  const userLikes = await prisma.postLike.findMany({
    where: {
      post_id: { in: postIds },
      user_id: userId,
    },
    select: { post_id: true },
  });

  const likedPostIds = new Set(userLikes.map(like => like.post_id));

  const pollIds = posts.map(p => p.poll?.id).filter(Boolean);
  let userVotes = [];
  if (pollIds.length > 0) {
    userVotes = await prisma.pollVote.findMany({
      where: {
        user_id: userId,
        option: {
          poll_id: { in: pollIds },
        },
      },
      select: {
        poll_option_id: true,
      },
    });
  }
  const votedOptionIds = new Set(userVotes.map(v => v.poll_option_id));

  const formattedPosts = posts.map(post => {
    if (post.poll) {
      let totalVotes = 0;
      let userVoted = false;
      let selectedOptionId = null;

      post.poll.options.forEach(option => {
        totalVotes += option._count.votes;
        if (votedOptionIds.has(option.id)) {
          userVoted = true;
          selectedOptionId = option.id;
        }
      });

      post.poll.has_voted = userVoted;
      post.poll.selected_option_id = selectedOptionId;
      post.poll.total_votes = totalVotes;

      // If user has voted, calculate percentages
      if (userVoted) {
        post.poll.options.forEach(option => {
          const voteCount = option._count.votes;
          option.percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
        });
      }
    }

    return {
      ...post,
      has_liked: likedPostIds.has(post.id),
      type: 'post',
    };
  });

  console.log(`📝 Posts fetched: ${formattedPosts.length}`);

  // 3️⃣ Fetch active deals in those neighborhoods
  const now = new Date();
  const deals = await prisma.deal.findMany({
    where: {
      neighborhood_id: { in: neighborhoodIds },
      status: 'active',
      OR: [
        { start_date: null },
        { start_date: { lte: now } },
      ],
      OR: [
        { end_date: null },
        { end_date: { gte: now } },
      ],
    },
    include: {
      business: {
        select: {
          business_name: true,
          category: true,
        },
      },
      media: {
        select: {
          id: true,
          url: true,
        },
      },
      neighborhood: {
        select: { name: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const formattedDeals = deals.map(deal => ({
    ...deal,
    type: 'deal',
  }));

  console.log(`💸 Deals fetched: ${formattedDeals.length}`);

  // 4️⃣ Combine and sort by creation date
  const combinedFeed = [...formattedPosts, ...formattedDeals].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  // 5️⃣ Paginate combined feed
  const paginatedFeed = combinedFeed.slice((page - 1) * limit, page * limit);

  console.log(`📦 Returning ${paginatedFeed.length} feed items`);
  return paginatedFeed;
};
