import asyncHandler from 'express-async-handler';
import { getUploadUrl } from '../services/media.service.js';

export const getUploadUrlController = asyncHandler(async (req, res) => {
  const { fileName, contentType } = req.query;
  if (!fileName || !contentType) {
    res.status(400);
    throw new Error('Query parameters "fileName" and "contentType" are required.');
  }

  const urls = await getUploadUrl(fileName, contentType);

  res.status(200).json(urls);
});