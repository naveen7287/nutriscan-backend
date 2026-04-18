import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(process.cwd(), 'db.json');

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ================= DATABASE =================

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

const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch {}
};

// ================= ROUTES =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Get logs
app.get('/api/logs', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  if (isMongoConnected) {
    const logs = await mongoose.connection.collection('foods')
      .find({ timestamp: { $regex: `^${today}` } })
      .toArray();
    return res.json(logs);
  }

  const db = readDB();
  const logs = db.logs.filter((l) => l.timestamp.startsWith(today));
  res.json(logs);
});

// Save log
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

// ================= GEMINI ANALYZE =================

app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image missing" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "API key missing" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const base64Data = image.includes('base64,')
      ? image.split('base64,')[1]
      : image;

    console.log("🔍 Analyzing image...");

    const modelList = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

    let text = "";
    let match = null;
    let success = false;

    // 🔥 RETRY LOOP (MODEL + RESPONSE)
    for (let attempt = 0; attempt < 2 && !success; attempt++) {

      const prompt = attempt === 0
        ? `Analyze this food image and return ONLY valid JSON.`
        : `STRICT: Return COMPLETE JSON only. Ensure JSON ends with }`;

      for (const name of modelList) {
        try {
          console.log(`Trying model: ${name} (attempt ${attempt + 1})`);

          const model = genAI.getGenerativeModel({ model: name });

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
                { text: prompt }
              ]
            }],
            generationConfig: {
              maxOutputTokens: 1000,
              temperature: 0.2
            }
          });

          const response = await result.response;
          text = response.text();

          if (!text) continue;

          // Clean markdown
          text = text.replace(/```json|```/g, "").trim();

          // Extract JSON
          match = text.match(/\{[\s\S]*\}/);

          if (match && match[0].endsWith("}")) {
            success = true;
            break;
          }

          console.log("⚠️ Incomplete JSON, retrying...");

        } catch (err) {
          console.log(`❌ Model failed: ${name}`, err.message);
        }
      }
    }

    // ❌ FINAL FAIL
    if (!success || !match) {
      console.error("❌ FINAL FAILURE:", text);
      return res.json(getFallback());
    }

    let data;

    try {
      data = JSON.parse(match[0]);
    } catch (err) {
      console.error("❌ JSON PARSE ERROR:", match[0]);
      return res.json(getFallback());
    }

    return res.json(data);

  } catch (error) {
    console.error("❌ AI ERROR:", error);
    return res.json(getFallback());
  }
});

// ✅ GLOBAL FALLBACK FUNCTION (VERY IMPORTANT)
function getFallback() {
  return {
    food_name: "Unknown Food",
    ingredients: [],
    nutrition: {
      calories: 0,
      protein_g: 0,
      fat_g: 0,
      carbs_g: 0,
      sugar_g: 0,
      fiber_g: 0
    },
    confidence: 0.5,
    health_recommendation: {
      should_consume: true,
      reason: "AI could not analyze properly"
    }
  };
}

// ================= ERROR HANDLER =================

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ================= START SERVER =================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
