const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ WARNING: Supabase credentials not configured. Storage operations will fail.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Storage service for managing file uploads and downloads in Supabase Storage
 */
class StorageService {
  /**
   * Upload a file to a specified bucket
   * @param {string} bucket - Bucket name (resumes, cover-letters, avatars)
   * @param {string} filePath - File path within the bucket
   * @param {Buffer|File} file - File data
   * @param {Object} options - Upload options (contentType, upsert)
   * @returns {Promise<Object>} Upload result with public URL
   */
  async uploadFile(bucket, filePath, file, options = {}) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          contentType: options.contentType || 'application/octet-stream',
          upsert: options.upsert || false
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return {
        path: data.path,
        publicUrl: urlData.publicUrl,
        fullPath: data.fullPath
      };
    } catch (error) {
      console.error(`❌ Error uploading file to ${bucket}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a file from a bucket
   * @param {string} bucket - Bucket name
   * @param {string} filePath - File path within the bucket
   * @returns {Promise<void>}
   */
  async deleteFile(bucket, filePath) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) throw error;
    } catch (error) {
      console.error(`❌ Error deleting file from ${bucket}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate a signed URL for temporary access
   * @param {string} bucket - Bucket name
   * @param {string} filePath - File path within the bucket
   * @param {number} expiresIn - Expiration time in seconds (default: 60)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(bucket, filePath, expiresIn = 60) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

      if (error) throw error;

      return data.signedUrl;
    } catch (error) {
      console.error(`❌ Error generating signed URL for ${bucket}:`, error.message);
      throw error;
    }
  }

  /**
   * Download a file as a buffer
   * @param {string} bucket - Bucket name
   * @param {string} filePath - File path within the bucket
   * @returns {Promise<Buffer>} File data
   */
  async downloadFile(bucket, filePath) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(filePath);

      if (error) throw error;

      return data;
    } catch (error) {
      console.error(`❌ Error downloading file from ${bucket}:`, error.message);
      throw error;
    }
  }

  /**
   * List all files in a bucket with optional prefix filter
   * @param {string} bucket - Bucket name
   * @param {string} prefix - Path prefix to filter (optional)
   * @returns {Promise<Array>} List of files
   */
  async listFiles(bucket, prefix = '') {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(prefix);

      if (error) throw error;

      return data;
    } catch (error) {
      console.error(`❌ Error listing files in ${bucket}:`, error.message);
      throw error;
    }
  }

  /**
   * Create a storage bucket if it doesn't exist
   * @param {string} bucketName - Name of the bucket to create
   * @param {boolean} isPublic - Whether the bucket should be public
   * @returns {Promise<void>}
   */
  async createBucket(bucketName, isPublic = false) {
    try {
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: isPublic
      });

      if (error && error.message !== 'Bucket already exists') {
        throw error;
      }

      console.log(`✅ Bucket ${bucketName} ready`);
    } catch (error) {
      console.error(`❌ Error creating bucket ${bucketName}:`, error.message);
      throw error;
    }
  }

  /**
   * Initialize all required storage buckets
   */
  async initializeBuckets() {
    const buckets = [
      { name: 'resumes', public: false },
      { name: 'cover-letters', public: false },
      { name: 'avatars', public: true }
    ];

    for (const bucket of buckets) {
      await this.createBucket(bucket.name, bucket.public);
    }
  }
}

module.exports = new StorageService();
