import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

let isConfigured = false;

const configureCloudinary = () => {
  if (isConfigured) {
    return;
  }

  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }

  isConfigured = true;
};

export const uploadQrCodeImage = async ({ storeSlug, dataUrl }) => {
  configureCloudinary();

  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return {
      url: dataUrl,
      publicId: null,
      provider: 'local_fallback'
    };
  }

  try {
    const uploadResult = await cloudinary.uploader.upload(dataUrl, {
      folder: 'digital-retail/qr-codes',
      public_id: storeSlug,
      overwrite: true,
      resource_type: 'image'
    });

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      provider: 'cloudinary'
    };
  } catch (error) {
    console.warn('Cloudinary upload failed, falling back to data URL:', error.message);

    return {
      url: dataUrl,
      publicId: null,
      provider: 'local_fallback'
    };
  }
};
