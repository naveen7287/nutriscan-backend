import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'db.json');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ... (Rest of the database and API logic from previous turn)

app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image missing' });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API key missing' });
    }

    const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
          { text: "Analyze food and return JSON with food_name, ingredients, nutrition, health_recommendation." }
        ]
      }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.2 }
    });

    const response = await result.response;
    let text = response.text().replace(/```json|```/g, "").trim();

    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: 'Invalid AI response' });
    }
  } catch (error) {
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// ... (Rest of the server logic)

async function startServer() {
  // ... (Vite/Static serving logic)
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}
startServer();
