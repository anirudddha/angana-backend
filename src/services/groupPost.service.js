import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createGroupPost = async (authorId, userId, groupId, data) => {
  const { content, mediaUrls = [] } = data;
  return prisma.$transaction(async (tx) => {
    const post = await tx.groupPost.create({
      data: { author_id: authorId, group_id: groupId, content }
    });
    if (mediaUrls && mediaUrls.length > 0) {
      const mediaData = mediaUrls.map(url => ({
        uploader_id: userId,
        url,
        group_post_id: post.id
      }));
      await tx.media.createMany({ data: mediaData });
    }
    return tx.groupPost.findUnique({ where: { id: post.id }, include: { media: true } });
  });
};

export const getGroupFeed = async (groupId, currentUserId) => {
  const posts = await prisma.groupPost.findMany({
    where: { group_id: groupId },
    include: {
      author: { select: { id: true, full_name: true, avatar_url: true } },
      media: { select: { url: true } },
      _count: { select: { likes: true, comments: true } }
    },
    orderBy: { created_at: 'desc' }
  });
  // Add `has_liked` status for the current user
  const postIds = posts.map(p => p.id);
  const userLikes = await prisma.groupPostLike.findMany({
    where: { group_post_id: { in: postIds }, user_id: currentUserId }
  });
  const likedPostIds = new Set(userLikes.map(like => like.group_post_id));
  return posts.map(post => ({ ...post, has_liked: likedPostIds.has(post.id) }));
};

export const likeGroupPost = async (userId, groupPostId) => {
  return prisma.groupPostLike.upsert({
    where: { user_id_group_post_id: { user_id: userId, group_post_id: groupPostId } },
    update: {},
    create: { user_id: userId, group_post_id: groupPostId }
  });
};

export const unlikeGroupPost = async (userId, groupPostId) => {
  return prisma.groupPostLike.delete({
    where: { user_id_group_post_id: { user_id: userId, group_post_id: groupPostId } }
  });
};

export const commentOnGroupPost = async (authorId, groupPostId, content) => {
  return prisma.groupPostComment.create({
    data: {
      author_id: authorId,
      group_post_id: groupPostId,
      content
    },
    include: {
      author: { select: { id: true, full_name: true, avatar_url: true } }
    }
  });
};

export const getGroupPostComments = async (groupPostId) => {
  return prisma.groupPostComment.findMany({
    where: { group_post_id: groupPostId },
    include: {
      author: { select: { id: true, full_name: true, avatar_url: true } }
    },
    orderBy: { created_at: 'asc' }
  });
};