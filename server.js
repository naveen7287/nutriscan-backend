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

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ================= DB SETUP =================
let isMongoConnected = false;
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI && MONGO_URI.startsWith('mongodb')) {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('✅ MongoDB Connected');
      isMongoConnected = true;
    })
    .catch(err => {
      console.error('❌ MongoDB Error:', err.message);
    });
}

// Local JSON fallback
const readDB = () => {
  try {
    if (!fs.existsSync(DB_FILE)) return { profiles: {}, logs: [] };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {
    return { profiles: {}, logs: [] };
  }
};

const writeDB = (data: any) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch {}
};

// ================= ROUTES =================

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Logs
app.get('/api/logs', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  if (isMongoConnected) {
    const logs = await mongoose.connection.collection('foods')
      .find({ timestamp: { $regex: `^${today}` } })
      .toArray();
    return res.json(logs);
  }

  const db = readDB();
  const logs = db.logs.filter((l: any) => l.timestamp.startsWith(today));
  res.json(logs);
});

// Save Log
app.post('/api/logs', async (req, res) => {
  const log = { ...req.body, timestamp: new Date().toISOString() };

  if (isMongoConnected) {
    await mongoose.connection.collection('foods').insertOne(log);
    return res.json(log);
  }

  const db = readDB();
  db.logs.push(log);
  writeDB(db);
  res.json(log);
});

// ================= AI ANALYZE =================

app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image missing" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "API key missing" });
    }

    // ✅ Init Gemini safely INSIDE route
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const base64Data = image.includes('base64,')
      ? image.split('base64,')[1]
      : image;

    console.log("🔍 Analyzing image...");

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg"
            }
          },
          {
            text: "Analyze this food and return ONLY JSON with food_name, ingredients, nutrition (calories, protein_g, fat_g, carbs_g, sugar_g, fiber_g), and health_recommendation (should_consume, reason)."
          }
        ]
      }],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.2
      }
    });

    const response = await result.response;
    let text = response.text();

    // ✅ Clean markdown
    text = text.replace(/```json|```/g, "").trim();

    // ✅ Extract JSON safely
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      console.error("❌ INVALID AI RESPONSE:", text);
      return res.status(500).json({ error: "Invalid AI response format" });
    }

    let data;

    try {
      data = JSON.parse(match[0]);
    } catch (err) {
      console.error("❌ JSON PARSE ERROR:", match[0]);
      return res.status(500).json({ error: "JSON parse failed" });
    }

    res.json(data);

  } catch (error) {
    console.error("❌ AI ERROR:", error);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

// ================= ERROR HANDLER =================

app.use((err: any, req: any, res: any, next: any) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ================= SERVER =================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
