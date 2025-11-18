import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createPost = async (
  authorId,
  {
    content,
    mediaUrls = [],
    categoryIds = [],
    pollQuestion,
    pollOptions,
    isUrgent = false,
  }
) => {
  if (!authorId) throw new Error("authorId is required");

  // Normalize category ids to numbers (Prisma Category.id is Int)
  const categoryConnect = Array.isArray(categoryIds)
    ? categoryIds.map((id) => ({ id: Number(id) }))
    : [];

  // 1) Find membership BEFORE the transaction (fast read)
  const membership = await prisma.neighborhoodMembership.findFirst({
    where: { user_id: authorId },
    select: { neighborhood_id: true },
  });

  if (!membership) {
    throw new Error("User does not belong to any neighborhood.");
  }

  // 2) Do writes in a short transaction: create post, poll (if any), media (if any)
  const createdPostId = await prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        content,
        author_id: authorId,
        neighborhood_id: membership.neighborhood_id,
        is_urgent: isUrgent,
        // connect categories only if provided
        ...(categoryConnect.length > 0 && {
          categories: { connect: categoryConnect },
        }),
      },
    });

    // create poll (if provided)
    if (pollQuestion && Array.isArray(pollOptions) && pollOptions.length > 1) {
      await tx.poll.create({
        data: {
          post_id: post.id,
          question: pollQuestion,
          options: {
            create: pollOptions.map((text) => ({ text })),
          },
        },
      });
    }

    // insert media (createMany is fastest) — ensure url and uploader
    if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      const mediaData = mediaUrls.map((url) => ({
        uploader_id: authorId,
        post_id: post.id,
        url,
      }));
      // createMany doesn't return rows; that's fine
      await tx.media.createMany({ data: mediaData });
    }

    // RETURN the created post id only (keep transaction short)
    return post.id;
  });

  // 3) Fetch the post with relations OUTSIDE the transaction (no timeout issues)
  const postWithRelations = await prisma.post.findUnique({
    where: { id: createdPostId },
    include: {
      media: { select: { id: true, url: true } },
      categories: true,
      poll: {
        include: {
          options: {
            include: {
              _count: { select: { votes: true } },
            },
          },
        },
      },
    },
  });

  return postWithRelations;
};


// In src/services/post.service.js
export const getPostDetails = async (postId, currentUserId) => {
    // 1️⃣ Fetch post with author, media, comments, and counts
    const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          author_id: true,
          neighborhood_id: true,
          content: true,
          is_pinned: true,
          is_urgent: true,
          created_at: true,
          author: { select: { user_id: true, full_name: true, avatar_url: true } },
          media: { select: { id: true, url: true } },
          categories: true,
          poll: {
            include: {
              options: {
                include: {
                  _count: { select: { votes: true } }
                }
              }
            }
          },
          comments: {
            where: { parent_comment_id: null },
            include: {
              author: { select: { full_name: true, avatar_url: true, user_id: true } },
              _count: { select: { replies: true } },
            },
            orderBy: { created_at: 'asc' },
          },
          _count: { select: { likes: true, comments: true } },
        }
    });

    if (!post) return null;

    // 👇 ADDED LOGIC FOR POLLS
    if (post.poll) {
      const userVote = await prisma.pollVote.findFirst({
        where: {
          user_id: currentUserId,
          option: {
            poll_id: post.poll.id,
          },
        },
        select: {
          poll_option_id: true,
        },
      });

      let totalVotes = 0;
      let userVoted = false;
      let selectedOptionId = null;

      post.poll.options.forEach(option => {
        totalVotes += option._count.votes;
        if (userVote && userVote.poll_option_id === option.id) {
          userVoted = true;
          selectedOptionId = option.id;
        }
      });

      post.poll.has_voted = userVoted;
      post.poll.selected_option_id = selectedOptionId;
      post.poll.total_votes = totalVotes;

      if (userVoted) {
        post.poll.options.forEach(option => {
          const voteCount = option._count.votes;
          option.percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
        });
      }
    }
    // 👆 END OF ADDED LOGIC FOR POLLS

    // 2️⃣ Check if the current user has liked the post
    const userLike = await prisma.postLike.findUnique({
        where: { user_id_post_id: { user_id: currentUserId, post_id: postId } },
    });

    // 3️⃣ Serialize BigInt fields for JSON safety
    const serializedPost = JSON.parse(
        JSON.stringify(
            {
                ...post,
                has_liked: !!userLike
            },
            (_, value) => (typeof value === 'bigint' ? value.toString() : value)
        )
    );

    return serializedPost;
};


export const addComment = async (authorId, postId, content) => {
    // 1️⃣ Ensure the post exists
    const postExists = await prisma.post.findUnique({
        where: { id: postId },
    });

    if (!postExists) {
        throw new Error('Post not found');
    }

    // 2️⃣ Create the comment
    const comment = await prisma.postComment.create({
        data: {
            post_id: postId,
            author_id: authorId, // Must match profiles.user_id
            content,
        },
    });

    // 3️⃣ Serialize BigInt fields
    const serializedComment = JSON.parse(
        JSON.stringify(comment, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );

    return serializedComment;
};

export const likePost = async (userId, postId) => {
    // Use upsert to prevent race conditions or duplicate likes.
    return prisma.postLike.upsert({
        where: { user_id_post_id: { user_id: userId, post_id: postId } },
        update: {},
        create: { user_id: userId, post_id: postId }
    });
};

export const unlikePost = async (userId, postId) => {
    return prisma.postLike.delete({
        where: { user_id_post_id: { user_id: userId, post_id: postId } }
    });
};