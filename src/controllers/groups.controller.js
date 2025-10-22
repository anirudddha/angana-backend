import asyncHandler from 'express-async-handler';
import * as groupService from '../services/group.service.js';

// Helper to convert BigInt -> string for JSON serialization
const serializeBigInt = (obj) =>
  JSON.parse(JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));

export const createGroupController = asyncHandler(async (req, res) => {
  // We only pass ONE ID: the authentication ID from the token.
  // This corresponds to `user_id` in the Profile table.
  const authUserId = req.user.id;

  const group = await groupService.createGroup(authUserId, req.body);
  // This one was already correct
  res.status(201).json(serializeBigInt(group));
});

export const getGroupDetailsController = asyncHandler(async (req, res) => {
  const groupId = BigInt(req.params.id);
  const group = await groupService.getGroupDetails(groupId, req.user.id);
  if (!group) {
    // Set status and send response for a "not found" case
    return res.status(404).json({ message: "Group not found." });
  }
  // Apply the helper here
  res.status(200).json(serializeBigInt(group));
});

export const findGroupsInNeighborhoodController = asyncHandler(async (req, res) => {
  const neighborhoodId = BigInt(req.params.id);
  const groups = await groupService.findGroupsInNeighborhood(neighborhoodId);
  // Apply the helper here (it works on arrays of objects too)
  res.status(200).json(serializeBigInt(groups));
});

export const joinGroupController = asyncHandler(async (req, res) => {
  const groupId = BigInt(req.params.id);
  // console.log(req.user);
  const membership = await groupService.joinGroup(req.user.user_id,req.user.id, groupId);
  // Apply the helper here
  res.status(200).json(serializeBigInt(membership));
});

export const leaveGroupController = asyncHandler(async (req, res) => {
  const groupId = BigInt(req.params.id);
  await groupService.leaveGroup(req.user.id, groupId);
  // No JSON body is sent, so no change is needed here
  res.status(204).send();
});

export const approveRequestController = asyncHandler(async (req, res) => {
  const groupId = BigInt(req.params.id);
  const { userId } = req.params;
  const updatedMembership = await groupService.approveRequest(groupId, userId);
  // Apply the helper here
  res.status(200).json(serializeBigInt(updatedMembership));
});

export const manageMemberController = asyncHandler(async (req, res) => {
  // convert as you were doing before
  const groupId = BigInt(req.params.id);
  const userId = req.params.userId || req.params.userId; // ensure your route uses :userId

  // Accept action/role from body, then fallback to query or params
  const actionFromBody  = req.body && Object.keys(req.body).length ? req.body.action : undefined;
  const roleFromBody    = req.body && Object.keys(req.body).length ? req.body.role   : undefined;

  const action = actionFromBody ?? req.query.action ?? req.params.action ?? undefined;
  const role   = roleFromBody   ?? req.query.role   ?? req.params.role   ?? undefined;

  // If no action provided anywhere, treat as "remove"
  const effectiveAction = action ?? 'remove';

  // Remove (DELETE semantics) — return 204
  if (effectiveAction === 'remove') {
    await groupService.manageMember(groupId, userId, 'remove');
    return res.status(204).send();
  }

  // Promote/Demote require role
  if (effectiveAction === 'promote' || effectiveAction === 'demote') {
    if (!role) {
      return res.status(400).json({ message: 'role is required for promote/demote' });
    }
    const updated = await groupService.manageMember(groupId, userId, effectiveAction, role);
    // return the updated membership (or 200/204 depending on your convention)
    return res.status(200).json(serializeBigInt(updated));
  }

  return res.status(400).json({ message: 'Invalid action' });
});