'use strict';

const { v2: cloudinary } = require('cloudinary');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/;
// Without Cloudinary the picture is stored inside the database row, so keep it small.
const MAX_INLINE_CHARS = 700_000;
const MAX_UPLOAD_CHARS = 3_000_000;

if (config.cloudinary.enabled) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

/** Overridable in tests. */
const driver = {
  upload: (dataUrl) =>
    cloudinary.uploader.upload(dataUrl, {
      folder: 'retailtrack/products',
      resource_type: 'image',
      allowed_formats: ['png', 'jpg', 'jpeg', 'webp'],
      transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
    }),
  destroy: (publicId) => cloudinary.uploader.destroy(publicId, { resource_type: 'image' }),
};

const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');

/** Checks that an image value is acceptable before anything is stored. */
function validateImage(value) {
  if (value === null || value === '' || value === undefined) return;
  if (/^https:\/\//.test(value)) return;
  if (/^\/products\/[\w.-]+$/.test(value)) return; // bundled example images served by the frontend
  if (!isDataUrl(value) || !DATA_URL.test(value)) {
    throw ApiError.badRequest('Product image must be a JPG, PNG or WebP image.', { image: ['Product image must be a JPG, PNG or WebP image.'] });
  }
  const limit = config.cloudinary.enabled ? MAX_UPLOAD_CHARS : MAX_INLINE_CHARS;
  if (value.length > limit) {
    throw ApiError.badRequest('The image is too large. Use a smaller image.', { image: ['The image is too large. Use a smaller image.'] });
  }
}

/**
 * Turns an `image` field from a request into database columns.
 * @param {string | null | undefined} input undefined = leave unchanged, ''/null = remove.
 * @param {{ image_url: string | null, image_public_id: string | null } | null} existing
 * @returns {Promise<{ patch: object, staleId: string | null }>} `staleId` is an old Cloudinary image to delete
 *          once the database update has succeeded.
 */
async function resolve(input, existing = null) {
  if (input === undefined) return { patch: {}, staleId: null };
  const oldId = existing?.image_public_id || null;

  if (input === null || input === '') {
    return { patch: { image_url: null, image_public_id: null }, staleId: oldId };
  }
  if (existing && input === existing.image_url) return { patch: {}, staleId: null };

  validateImage(input);
  if (!isDataUrl(input)) return { patch: { image_url: input, image_public_id: null }, staleId: oldId };

  if (!config.cloudinary.enabled) return { patch: { image_url: input, image_public_id: null }, staleId: oldId };

  try {
    const result = await driver.upload(input);
    return { patch: { image_url: result.secure_url, image_public_id: result.public_id }, staleId: oldId };
  } catch (err) {
    console.error('Cloudinary upload failed:', err.message || err);
    throw new ApiError(502, 'The image could not be uploaded. Please try again.');
  }
}

/** Best-effort removal of an image that is no longer referenced. Never throws. */
async function discard(publicId) {
  if (!publicId || !config.cloudinary.enabled) return;
  try {
    await driver.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary cleanup failed:', err.message || err);
  }
}

module.exports = { resolve, discard, validateImage, driver };
