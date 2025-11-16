import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createReport = async (reporterId, { reasonId, comment, postId, postCommentId, groupPostId, profileId }) => {
  // Ensure only one content type is reported
  const reportedContentCount = [postId, postCommentId, groupPostId, profileId].filter(Boolean).length;
  if (reportedContentCount !== 1) {
    throw new Error('A report must target exactly one type of content (post, comment, group post, or profile).');
  }

  // Ensure the reasonId is valid
  const reason = await prisma.reportReason.findUnique({
    where: { id: reasonId },
  });
  if (!reason) {
    throw new Error(`Invalid report reason ID: ${reasonId}`);
  }

  return prisma.report.create({
    data: {
      reporter_id: reporterId,
      reason_id: reasonId,
      comment,
      post_id: postId,
      post_comment_id: postCommentId,
      group_post_id: groupPostId,
      profile_id: profileId,
    },
  });
};

export const getReports = async (statusFilter) => {
  const where = statusFilter ? { status: statusFilter } : {};
  return prisma.report.findMany({
    where,
    include: {
      reporter: { select: { user_id: true, full_name: true } },
      reason: true,
      post: { select: { id: true, content: true } },
      post_comment: { select: { id: true, content: true } },
      group_post: { select: { id: true, content: true } },
      reported_profile: { select: { user_id: true, full_name: true } },
    },
    orderBy: {
      created_at: 'desc',
    },
  });
};

export const getReportById = async (reportId) => {
  return prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: { user_id: true, full_name: true } },
      reason: true,
      post: { select: { id: true, content: true } },
      post_comment: { select: { id: true, content: true } },
      group_post: { select: { id: true, content: true } },
      reported_profile: { select: { user_id: true, full_name: true } },
    },
  });
};

export const updateReportStatus = async (reportId, newStatus) => {
  return prisma.report.update({
    where: { id: reportId },
    data: { status: newStatus },
  });
};

export const getReportReasons = async () => {
  return prisma.reportReason.findMany({
    orderBy: {
      reason: 'asc',
    },
  });
};

export const createReportReason = async ({ reason, description }) => {
  return prisma.reportReason.create({
    data: {
      reason,
      description,
    },
  });
};