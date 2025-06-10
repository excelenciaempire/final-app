const { createClient } = require('@deepgram/sdk');
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const transcribeAudioController = async (req, res) => {
  // Log the entire request body first
  console.log('[TranscribeController] Received req.body:', JSON.stringify(req.body, null, 2));

  const { audioBase64 } = req.body;

  if (!audioBase64) {
    console.error('[TranscribeController] audioBase64 is missing or undefined in req.body.');
    return res.status(400).json({ message: 'Missing audioBase64 in request body' });
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    console.log(`Received audio buffer, size: ${audioBuffer.length}. Sending to Deepgram...`);

    const source = {
      buffer: audioBuffer,
      mimetype: 'audio/mp4',
    };

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      source,
      {
        model: 'nova-2',
        smart_format: true,
        language: 'en-US',
      }
    );

    if (error) {
      console.error('Deepgram transcription error:', error);
      throw new Error(error.message || 'Deepgram API request failed');
    }

    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
    console.log("Transcript:", transcript);

    return res.status(200).json({ transcript });
  } catch (err) {
    console.error('Transcription failed:', err);
    return res.status(500).json({ message: 'Transcription failed', details: err.message });
  }
};

module.exports = { transcribeAudioController };
