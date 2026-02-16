import { supabaseUrl, supabaseAnonKey } from './supabase';

// Helper: get auth token directly from localStorage
const getAuthToken = () => {
  try {
    const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token;
    }
  } catch (e) {
    console.error('Failed to read auth token:', e);
  }
  return supabaseAnonKey;
};

/**
 * Compress and resize an image file to a max 256x256 WebP blob.
 * Returns a Blob ready for upload.
 */
const compressImage = (file, maxSize = 256, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate dimensions (square crop from centre)
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = maxSize;
      canvas.height = maxSize;
      const ctx = canvas.getContext('2d');

      // Draw cropped and resized
      ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * Upload a profile avatar for the given user.
 * Compresses to 256x256 WebP, uploads to Supabase Storage.
 * Returns the public URL of the uploaded avatar.
 */
export const uploadAvatar = async (userId, file) => {
  if (!userId || !file) throw new Error('Missing userId or file');

  // Compress the image
  const blob = await compressImage(file);
  const filePath = `${userId}/avatar.webp`;
  const token = getAuthToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    // Upload to Supabase Storage (upsert)
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/avatars/${filePath}`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'image/webp',
          'x-upsert': 'true',
        },
        body: blob,
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Upload failed: ${body.slice(0, 200)}`);
    }

    // Return the public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${filePath}`;

    // Update the profile with the avatar URL (bust cache with timestamp)
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;
    await updateProfileAvatar(userId, avatarUrl);

    return avatarUrl;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Upload timed out');
    }
    throw err;
  }
};

/**
 * Delete the user's avatar from storage and clear the profile URL.
 */
export const deleteAvatar = async (userId) => {
  if (!userId) return;
  const token = getAuthToken();
  const filePath = `${userId}/avatar.webp`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    await fetch(
      `${supabaseUrl}/storage/v1/object/avatars/${filePath}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    // Clear the avatar URL in the profile
    await updateProfileAvatar(userId, null);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Delete timed out');
    }
    throw err;
  }
};

/**
 * Get the public avatar URL for a user, or null if none.
 */
export const getAvatarUrl = (userId) => {
  if (!userId) return null;
  return `${supabaseUrl}/storage/v1/object/public/avatars/${userId}/avatar.webp`;
};

/**
 * Update the avatar_url field in the profiles table.
 */
const updateProfileAvatar = async (userId, avatarUrl) => {
  const token = getAuthToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Profile update failed: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Profile update timed out');
    }
    throw err;
  }
};
