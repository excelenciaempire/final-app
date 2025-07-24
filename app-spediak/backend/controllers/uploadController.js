const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Configure multer storage for images
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'spediak-inspections',
    format: async (req, file) => 'jpg', // supports promises as well
    public_id: (req, file) => `inspection-${Date.now()}`,
  },
});

const upload = multer({ storage: storage });


// Configure multer for audio files (memory storage)
const audioStorage = multer.memoryStorage();
const uploadAudio = multer({ storage: audioStorage });


const uploadImageController = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file uploaded.' });
  }
  // The file is already uploaded to Cloudinary by multer-storage-cloudinary
  // The path is the URL of the uploaded image.
  res.status(200).json({ imageUrl: req.file.path });
};

module.exports = { 
    uploadImageController,
    upload, // Export the configured multer instance for images
    uploadAudio // Export the configured multer instance for audio
}; 