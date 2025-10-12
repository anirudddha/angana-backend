import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createPost = async (authorId, { content, mediaUrls = [] }) => {
    // Use a transaction
    return prisma.$transaction(async (tx) => {
  
      // 1. Fetch the user's neighborhood membership
      const membership = await tx.neighborhoodMembership.findFirst({
        where: { user_id: authorId },
        select: { neighborhood_id: true },
      });
  
      if (!membership) {
        throw new Error("User does not belong to any neighborhood.");
      }
  
      // 2. Create the post
      const post = await tx.post.create({
        data: {
          content,
          author_id: authorId,
          neighborhood_id: membership.neighborhood_id,
        },
      });
  
      // 3. Insert media if provided
      if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
        const mediaData = mediaUrls.map((url) => ({
          uploader_id: authorId,
          post_id: post.id,
          url,
        }));
  
        await tx.media.createMany({ data: mediaData });
      }
  
      // 4. Fetch and return the post with media
      const postWithMedia = await tx.post.findUnique({
        where: { id: post.id },
        include: { media: true },
      });
  
      return postWithMedia;
    });
  };
  

// In src/services/post.service.js
export const getPostDetails = async (postId, currentUserId) => {
    // 1️⃣ Fetch post with author, media, comments, and counts
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            author: { select: { user_id: true, full_name: true, avatar_url: true } },
            media: { select: { id: true, url: true } }, // Include media
            comments: {
                where: { parent_comment_id: null }, // top-level comments only
                include: {
                    author: { select: { full_name: true, avatar_url: true, user_id: true } },
                    _count: { select: { replies: true } },
                },
                orderBy: { created_at: 'asc' },
            },
            _count: { select: { likes: true, comments: true } }, // counts
        },
    });

    if (!post) return null;

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