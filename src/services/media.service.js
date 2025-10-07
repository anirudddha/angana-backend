import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { S3 } from '../config/r2.js';

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;
const UPLOAD_URL_EXPIRATION_SECONDS = 300; // 5 minutes

export const getUploadUrl = async (fileName, contentType) => {
  if (!fileName || !contentType) {
    throw new Error('fileName and contentType are required');
  }

  // Generate a unique key for the object to prevent overwrites
  const fileExtension = fileName.split('.').pop();
  const key = `${randomUUID()}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  // Generate the pre-signed URL
  const signedUrl = await getSignedUrl(S3, command, {
    expiresIn: UPLOAD_URL_EXPIRATION_SECONDS,
  });

  return {
    uploadUrl: signedUrl,
    publicUrl: `${PUBLIC_URL}/${key}`, // The final URL after upload
  };
};