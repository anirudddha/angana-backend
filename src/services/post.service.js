import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createPost = async (authorId, { content, neighborhoodId }) => {
    // TODO: Add logic to verify user is a member of the neighborhood
    return prisma.post.create({
        data: {
            content,
            author_id: authorId,
            neighborhood_id: neighborhoodId,
        },
    });
};

export const getPostDetails = async (postId, currentUserId) => {
    // 1️⃣ Raw query with proper type casts
    const result = await prisma.$queryRaw`
    SELECT
      p.id,
      p.content,
      p.created_at,
      json_build_object(
        'user_id', author.user_id,
        'full_name', author.full_name,
        'avatar_url', author.avatar_url
      ) AS author,
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS "like_count",
      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS "comment_count",
      EXISTS(
        SELECT 1 
        FROM post_likes 
        WHERE post_id = p.id AND user_id = ${currentUserId}::uuid
      ) AS "has_liked"
    FROM posts p
    JOIN profiles author ON p.author_id = author.user_id
    WHERE p.id = ${postId}::bigint;
  `;

    const post = result[0];
    if (!post) return null;

    // 2️⃣ Fetch top-level comments separately
    const comments = await prisma.postComment.findMany({
        where: { post_id: postId, parent_comment_id: null },
        include: {
            author: { select: { full_name: true, avatar_url: true, user_id: true } },
            _count: { select: { replies: true } },
        },
        orderBy: { created_at: 'asc' },
    });

    post.comments = comments;

    // 3️⃣ Serialize BigInt fields
    const serializedPost = JSON.parse(
        JSON.stringify(post, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
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