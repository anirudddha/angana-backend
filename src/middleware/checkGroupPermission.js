import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const getMembership = async (userId, groupId) => {
  return prisma.groupMembership.findUnique({
    where: { user_id_group_id: { user_id: userId, group_id: groupId } }
  });
};

export const checkGroupMembership = async (req, res, next) => {
  try {
    const groupId = BigInt(req.params.id || req.params.groupId);
    const membership = await getMembership(req.user.id, groupId);

    if (!membership || membership.status !== 'active') {
      const err = new Error('Forbidden: You are not a member of this group.');
      err.statusCode = 403;
      return next(err);
    }

    req.membership = membership; // attach for later use
    next();
  } catch (error) {
    // If BigInt() or prisma throws, pass the error to the error handler
    next(error);
  }
};

export const checkGroupAdmin = async (req, res, next) => {
  try {
    const groupId = BigInt(req.params.id || req.params.groupId);
    const membership = await getMembership(req.user.id, groupId);

    if (!membership || membership.role !== 'admin') {
      const err = new Error('Forbidden: You must be a group admin to perform this action.');
      err.statusCode = 403;
      return next(err);
    }

    req.membership = membership;
    next();
  } catch (error) {
    next(error);
  }
};
