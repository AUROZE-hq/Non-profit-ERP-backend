import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary using environment variables
// The SDK will automatically use CLOUDINARY_URL if it's set in the environment.
// However, we explicitly pass the config fields to be safe.
if (process.env.CLOUDINARY_URL) {
  // Cloudinary SDK automatically picks up CLOUDINARY_URL from the environment.
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Upload a local file to Cloudinary
 * @param filePath Path to the local file to upload
 * @param destName The destination public ID (path) in Cloudinary
 * @returns Cloudinary URL, public ID, and format
 */
export async function uploadToCloudinary(filePath: string, destName: string) {
  // Try to use a specific folder if provided in env, else fallback
  const folder = process.env.CLOUDINARY_FOLDER || 'documents/finance';
  
  // destName may already contain folder prefix if modeled like GCS, so we extract just the filename
  // Actually, we can just use destName as the public_id, prepended with the folder if we want.
  // Given GCS used `finance/salary_slip_....pdf`, we can just pass that as public_id (without extension ideally, but cloudinary handles it).
  const publicId = `${folder}/${destName.replace(/\.pdf$/i, '').split('/').pop()}`;

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'auto', // Auto detects PDF
      public_id: publicId,
      format: 'pdf',
      type: 'upload',
      access_mode: 'public',
      flags: 'attachment', // Helps enforce the browser to download the file instead of rendering it inside a frame
    });

    return {
      cloudinaryUrl: result.secure_url,
      publicId: result.public_id,
      assetId: result.asset_id,
      format: result.format || 'pdf',
      folder: result.folder || folder,
      fileName: result.original_filename || destName,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}
