import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import  gTTS  from 'gtts';

const app = express();
const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// צור תיקיית קבצים זמניים
app.use('/audio', express.static(path.join('.', 'audio')));

app.post('/ask', upload.single('audio'), async (req, res) => {
  try {
    const filePath = req.file.path;

    // המרה לטקסט בעזרת Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      response_format: "text",
      language: "he"
    });
    const question = transcription.text || transcription;

    // שליחת השאלה ל־ChatGPT
    const chat = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: question }]
    });
    const answer = chat.choices[0].message.content;

    // המרת תשובה ל‑mp3 בעברית
    const gtts = new gTTS(answer, 'he');
    const responseFile = `audio/response-${Date.now()}.mp3`;
    await new Promise((r, rej) =>
      gtts.save(responseFile, err => (err ? rej(err) : r()))
    );

    // שליחה למערכת
    const fullUrl = `${req.protocol}://${req.get('host')}/${responseFile}`;
    return res.json({ url: fullUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).send("שגיאה פנימית");
  } finally {
    // ניקה?
  }
});

app.get('/', (_, res) => {
  res.send('GPT IVR service live');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
