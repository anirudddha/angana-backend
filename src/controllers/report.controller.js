import asyncHandler from 'express-async-handler';
import * as reportService from '../services/report.service.js';

const serializeBigInts = (data) => {
  return JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

export const createReportController = asyncHandler(async (req, res) => {
  const { reasonId, comment, postId, postCommentId, groupPostId, profileId } = req.body;
  const reporterId = req.user.user_id; // Assuming req.user is populated by authentication middleware

  if (!reasonId) {
    res.status(400);
    throw new Error('Report reason is required.');
  }

  const report = await reportService.createReport(reporterId, {
    reasonId,
    comment,
    postId,
    postCommentId,
    groupPostId,
    profileId,
  });

  res.status(201).json(serializeBigInts(report));
});

export const getReportsController = asyncHandler(async (req, res) => {
  const { status } = req.query; // Optional status filter
  const reports = await reportService.getReports(status);
  res.status(200).json(serializeBigInts(reports));
});

export const getReportByIdController = asyncHandler(async (req, res) => {
  const reportId = parseInt(req.params.id);
  const report = await reportService.getReportById(reportId);

  if (!report) {
    res.status(404);
    throw new Error('Report not found.');
  }

  res.status(200).json(serializeBigInts(report));
});

export const updateReportStatusController = asyncHandler(async (req, res) => {
  const reportId = parseInt(req.params.id);
  const { status } = req.body;

  if (!status) {
    res.status(400);
    throw new Error('New status is required.');
  }

  const updatedReport = await reportService.updateReportStatus(reportId, status);

  if (!updatedReport) {
    res.status(404);
    throw new Error('Report not found.');
  }

  res.status(200).json(serializeBigInts(updatedReport));
});

export const getReportReasonsController = asyncHandler(async (req, res) => {
  const reasons = await reportService.getReportReasons();
  res.status(200).json(reasons);
});

export const createReportReasonController = asyncHandler(async (req, res) => {
  const { reason, description } = req.body;

  if (!reason) {
    res.status(400);
    throw new Error('Reason is required.');
  }

  const newReason = await reportService.createReportReason({ reason, description });
  res.status(201).json(newReason);
});