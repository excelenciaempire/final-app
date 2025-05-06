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

module.exports = { uploadImageController }; 