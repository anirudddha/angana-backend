import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Creates a new group and makes the creator the first admin.
 */
export const createGroup = async (authUserId, data) => {
  const { name, description, privacy_level = 'public', mediaUrls = [] } = data;

  // STEP 1: Fetch the user's profile using their AUTHENTICATION ID.
  const profile = await prisma.profile.findUnique({
    where: { id: authUserId }, // CORRECT: Look up by the unique auth ID.
  });

  if (!profile) {
    throw new Error("User profile not found for the given authentication ID.");
  }

  // console.log(profile);
  // STEP 2: Check for neighborhood membership using the AUTHENTICATION ID.
  const membership = await prisma.neighborhoodMembership.findFirst({
    where: { user_id: profile.user_id }, // This relation uses the auth ID.
  });

  if (!membership) {
    throw new Error("User must be a member of a neighborhood to create a group.");
  }

  return prisma.$transaction(async (tx) => {
    // STEP 3: Create the group using the PROFILE'S PRIMARY KEY.
    const group = await tx.group.create({
      data: {
        creator_id: profile.id, // CORRECT: This relation needs the profile's primary key (`id`).
        neighborhood_id: membership.neighborhood_id,
        name,
        description,
        privacy_level,
      },
    });

    // STEP 4: Create the admin membership using the PROFILE'S PRIMARY KEY.
    await tx.groupMembership.create({
      data: {
        group_id: group.id,
        user_id: profile.id, // CORRECT: This relation also needs the profile's primary key (`id`).
        role: 'admin',
        status: 'active',
      },
    });

    // STEP 5: Create media using the AUTHENTICATION ID.
    if (mediaUrls && mediaUrls.length > 0) {
      const mediaData = mediaUrls.map((url) => ({
        uploader_id: profile.user_id, // CORRECT: This relation needs the auth ID (`user_id`).
        url,
        group_id: group.id,
      }));
      await tx.media.createMany({ data: mediaData });
    }

    return tx.group.findUnique({
      where: { id: group.id },
      include: { media: true },
    });
  });
};

/**
 * Fetches public details for a single group.
 * Also includes membership status for the current user.
 */
export const getGroupDetails = async (groupId, currentUserId) => {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      creator: { select: { id: true, full_name: true } },
      media: { select: { url: true }, take: 1 },
      _count: { select: { memberships: { where: { status: 'active' } } } }
    }
  });

  if (!group) return null;

  const membership = await prisma.groupMembership.findUnique({
    where: { user_id_group_id: { user_id: currentUserId, group_id: groupId } }
  });

  return { ...group, membership_status: membership?.status, role: membership?.role };
};

/**
 * Fetches all public groups within a given neighborhood.
 */
export const findGroupsInNeighborhood = async (neighborhoodId) => {
  return prisma.group.findMany({
    where: {
      neighborhood_id: neighborhoodId,
      privacy_level: 'public'
    },
    include: {
      media: { select: { url: true }, take: 1 },
      _count: { select: { memberships: { where: { status: 'active' } } } }
    },
    orderBy: { created_at: 'desc' }
  });
};

/**
 * Allows a user to join a group or request to join a private one.
 */
export const joinGroup = async (userId,uuId, groupId) => {
  // Step 1: Find the group without rejectOnNotFound
  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });

  // Step 2: Manually check if the group exists and throw an error if it doesn't
  if (!group) {
    // This creates a "not found" error similar to what rejectOnNotFound does
    throw new Error(`Group with ID ${groupId} not found.`); 
  }


  // Step 3: Find the neighborhood membership
  const neighborhoodMembership = await prisma.neighborhoodMembership.findUnique({
    where: {
      // Assuming you have a composite unique key in your schema: @@unique([user_id, neighborhood_id])
      user_id_neighborhood_id: {
        user_id: userId,
        neighborhood_id: group.neighborhood_id,
      },
    },
  });
  // Step 4: Manually check if that membership exists
  if (!neighborhoodMembership) {
    throw new Error("You must be a member of the group's neighborhood to join.");
  }

  // The rest of the logic remains the same
  const status = group.privacy_level === 'private' ? 'pending' : 'active';

  return prisma.groupMembership.upsert({
    where: { user_id_group_id: { user_id: uuId, group_id: groupId } },
    update: { status },
    create: { user_id: uuId, group_id: groupId, status },
  });
};

/**
 * Allows a user to leave a group.
 */
export const leaveGroup = async (userId, groupId) => {
  // Step 1: Find the user's membership in the group
  const membership = await prisma.groupMembership.findUnique({
    where: {
      user_id_group_id: { user_id: userId, group_id: groupId }
    }
  });

  // Step 2: Manually check if the membership exists. If not, throw an error.
  // This replaces the functionality of `rejectOnNotFound`.
  if (!membership) {
    throw new Error("Membership not found. You cannot leave a group you are not a member of.");
  }

  // Step 3: The rest of the logic is the same. Check if the user is the last admin.
  if (membership.role === 'admin') {
    const adminCount = await prisma.groupMembership.count({
      where: { group_id: groupId, role: 'admin' }
    });
    if (adminCount <= 1) {
      throw new Error("You cannot leave as you are the last admin. Please transfer ownership or delete the group.");
    }
  }

  // If the checks pass, delete the membership.
  return prisma.groupMembership.delete({
    where: {
      user_id_group_id: { user_id: userId, group_id: groupId }
    }
  });
};

/**
 * (Admin action) Approves a pending membership request.
 */
export const approveRequest = async (groupId, targetUserId) => {
  return prisma.groupMembership.update({
    where: { user_id_group_id: { user_id: targetUserId, group_id: groupId }, status: 'pending' },
    data: { status: 'active' }
  });
};

/**
 * (Admin action) Manages a member's role or removes them.
 */
export const manageMember = async (groupId, targetUserId, action, role = 'member') => {
  if (action === 'remove') {
    return prisma.groupMembership.delete({
      where: { user_id_group_id: { user_id: targetUserId, group_id: groupId } }
    });
  } else if (action === 'promote' || action === 'demote') {
    return prisma.groupMembership.update({
      where: { user_id_group_id: { user_id: targetUserId, group_id: groupId } },
      data: { role }
    });
  }
};