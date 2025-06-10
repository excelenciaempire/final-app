const OpenAI = require('openai');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// A map to get the correct file extension from the mimetype
const mimeTypeExtensions = {
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/amr': 'amr',
  'audio/webm': 'webm',
  // Add other supported mimetypes here if needed
};

const transcribeAudioController = async (req, res) => {
  console.log('[TranscribeController] Received request for OpenAI transcription.');

  const { audioBase64, mimetype } = req.body;

  if (!audioBase64 || !mimetype) {
    const missingParam = !audioBase64 ? 'audioBase64' : 'mimetype';
    console.error(`[TranscribeController] ${missingParam} is missing in req.body.`);
    return res.status(400).json({ message: `Missing ${missingParam} in request body` });
  }

  const fileExtension = mimeTypeExtensions[mimetype];
  if (!fileExtension) {
    console.error(`[TranscribeController] Unsupported mimetype: ${mimetype}`);
    return res.status(400).json({ message: `Unsupported mimetype: ${mimetype}` });
  }

  // Create a temporary file path
  const tempFileName = `temp_audio_${Date.now()}.${fileExtension}`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);
  console.log(`[TranscribeController] Creating temporary file at: ${tempFilePath}`);

  try {
    // Convert base64 to a buffer and write to the temporary file
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    fs.writeFileSync(tempFilePath, audioBuffer);
    console.log(`[TranscribeController] Temporary file created, size: ${audioBuffer.length} bytes.`);

    // Call the OpenAI Whisper API for transcription
    console.log('[TranscribeController] Sending audio to OpenAI Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1', // Use the whisper-1 model
    });

    console.log('[TranscribeController] Transcription successful.');
    const transcript = transcription.text;
    console.log('Transcript:', transcript);

    return res.status(200).json({ transcript });
  } catch (err) {
    console.error('OpenAI transcription failed:', err);
    const errorMessage = err.response ? JSON.stringify(err.response.data) : err.message;
    return res.status(500).json({ message: 'Transcription failed', details: errorMessage });
  } finally {
    // Clean up: delete the temporary file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`[TranscribeController] Deleted temporary file: ${tempFilePath}`);
    }
  }
};

module.exports = { transcribeAudioController };
