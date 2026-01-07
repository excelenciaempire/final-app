const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables

// Configure Cloudinary
// Make sure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET are set in Render Env Vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Use https
});

const uploadImageController = async (req, res) => {
  console.log('[uploadController.js] Entered for URL:', req.originalUrl);
  console.log('[uploadController.js] req.auth from middleware:', req.auth ? { userId: req.auth.userId, sessionId: req.auth.sessionId, orgId: req.auth.orgId } : 'null or undefined');
  console.log('[uploadController.js] All Headers:', JSON.stringify(req.headers, null, 2));

  // It's crucial that requireAuth has already populated req.auth
  // If req.auth is not populated here, the middleware isn't working as expected for this route.
  if (!req.auth || !req.auth.userId) {
    console.warn('[uploadController.js] Auth check failed: req.auth.userId is missing. Responding with 401.');
    // This response will be sent if requireAuth somehow let the request through without proper auth,
    // or if requireAuth is not even running for this route (which seems unlikely given api.js).
    return res.status(401).json({ message: 'User not authenticated. Access denied by upload controller.' });
  }
  // If we reach here, req.auth.userId should be available and valid.
  console.log(`[uploadController.js] User ${req.auth.userId} is authenticated. Proceeding with image upload logic.`);

  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ message: 'Missing imageBase64 in request body' });
  }

  try {
    console.log('[CloudinaryUpload] Attempting to upload image...');
    // Upload the base64 image to Cloudinary
    // We need to include the data URI prefix for Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${imageBase64}`,
      {
        resource_type: 'image',
        // Optional: Add folder, tags, transformations etc.
        // folder: 'spediak_inspections',
      }
    );

    console.log('[CloudinaryUpload] Upload successful. URL:', uploadResponse.secure_url);
    // Return the secure URL of the uploaded image
    return res.status(200).json({ imageUrl: uploadResponse.secure_url });

  } catch (error) {
    console.error('[CloudinaryUpload] Error uploading to Cloudinary:', error);
    return res.status(500).json({ message: 'Failed to upload image', details: error.message });
  }
};

/**
 * Upload ad image with optional cropping
 */
const uploadAdImage = async (req, res) => {
  console.log('[uploadController.js] uploadAdImage called');

  if (!req.auth || !req.auth.userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  const { image, crop, originalSize } = req.body;

  if (!image) {
    return res.status(400).json({ message: 'Missing image data' });
  }

  try {
    console.log('[CloudinaryUpload] Uploading ad image...');
    
    // Build transformation options for cropping
    let transformations = [];
    
    if (crop && originalSize && originalSize.width && originalSize.height) {
      // Calculate crop coordinates as percentages (Cloudinary uses absolute pixel values)
      const cropX = Math.round(crop.x);
      const cropY = Math.round(crop.y);
      const cropWidth = Math.round(crop.width);
      const cropHeight = Math.round(crop.height);
      
      transformations.push({
        crop: 'crop',
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight
      });
      
      // Resize to final ad dimensions (500x120)
      transformations.push({
        width: 500,
        height: 120,
        crop: 'fill'
      });
    } else {
      // If no crop data, just resize to ad dimensions
      transformations.push({
        width: 500,
        height: 120,
        crop: 'fill',
        gravity: 'center'
      });
    }

    // Upload to Cloudinary with transformations
    const uploadResponse = await cloudinary.uploader.upload(image, {
      resource_type: 'image',
      folder: 'spediak_ads',
      transformation: transformations
    });

    console.log('[CloudinaryUpload] Ad image upload successful. URL:', uploadResponse.secure_url);
    
    return res.status(200).json({ 
      url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id
    });

  } catch (error) {
    console.error('[CloudinaryUpload] Error uploading ad image:', error);
    return res.status(500).json({ message: 'Failed to upload image', details: error.message });
  }
};

module.exports = { uploadImageController, uploadAdImage }; 