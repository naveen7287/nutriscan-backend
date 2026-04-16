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

// Initialize Gemini AI using the standard SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ✅ MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ HYBRID DATABASE LOGIC
let isMongoConnected = false;
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI && MONGO_URI.startsWith('mongodb')) {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('✅ MongoDB Connected Successfully');
      isMongoConnected = true;
    })
    .catch(err => {
      console.error('❌ MongoDB Connection Failed:', err.message);
      console.log('⚠️ Falling back to local JSON storage (db.json)');
    });
} else {
  console.log('ℹ️ No valid MONGO_URI provided. Using local JSON storage (db.json)');
}

// Local JSON Helpers
const readLocalDB = () => {
  try {
    if (!fs.existsSync(DB_FILE)) return { profiles: {}, logs: [] };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (e) { return { profiles: {}, logs: [] }; }
};
const writeLocalDB = (data: any) => {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); } catch (e) {}
};

// ✅ SCHEMAS (Mongoose)
const FoodSchema = new mongoose.Schema({
  food_name: String,
  ingredients: [String],
  nutrition: {
    calories: Number, protein_g: Number, fat_g: Number,
    carbs_g: Number, sugar_g: Number, fiber_g: Number
  },
  type: String,
  timestamp: { type: String, default: () => new Date().toISOString() },
  createdAt: { type: Date, default: Date.now }
});
const Food = mongoose.model('Food', FoodSchema);

const ProfileSchema = new mongoose.Schema({
  name: String, age: Number, height: Number, weight: Number,
  gender: String, activityLevel: String, healthIssues: String, unit: String,
  targets: {
    calories: Number, protein_g: Number, fat_g: Number,
    carbs_g: Number, sugar_g: Number, fiber_g: Number
  },
  createdAt: { type: Date, default: Date.now }
});
const Profile = mongoose.model('Profile', ProfileSchema);

// ✅ HELPERS
function calculateTargets(profile: any) {
  const { weight, height, age, gender, activityLevel } = profile;
  let bmr = gender === 'male' 
    ? (10 * weight + 6.25 * height - 5 * age + 5)
    : (10 * weight + 6.25 * height - 5 * age - 161);

  const multipliers: Record<string, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };

  const tdee = Math.round(bmr * (multipliers[activityLevel] || 1.2));
  return {
    calories: tdee,
    protein_g: Math.round((tdee * 0.30) / 4),
    fat_g: Math.round((tdee * 0.25) / 9),
    carbs_g: Math.round((tdee * 0.45) / 4),
    sugar_g: Math.round((tdee * 0.10) / 4),
    fiber_g: Math.round((tdee / 1000) * 14),
  };
}

// ✅ API ROUTES
app.get('/api/profile', async (req, res) => {
  try {
    if (isMongoConnected) {
      const profile = await Profile.findOne().sort({ createdAt: -1 });
      return res.json(profile);
    }
    const db = readLocalDB();
    res.json(db.profiles.default || null);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch profile' }); }
});

app.post('/api/profile', async (req, res) => {
  try {
    const profileData = req.body;
    const targets = calculateTargets(profileData);
    if (isMongoConnected) {
      const updated = await Profile.findOneAndUpdate({}, { ...profileData, targets }, { upsert: true, new: true });
      return res.json(updated);
    }
    const db = readLocalDB();
    db.profiles.default = { ...profileData, targets };
    writeLocalDB(db);
    res.json(db.profiles.default);
  } catch (error) { res.status(500).json({ error: 'Failed to save profile' }); }
});

app.get('/api/logs', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    if (isMongoConnected) {
      const logs = await Food.find({ timestamp: { $regex: `^${today}` } }).sort({ createdAt: -1 });
      return res.json(logs);
    }
    const db = readLocalDB();
    const todayLogs = db.logs.filter((l: any) => l.timestamp.startsWith(today));
    res.json(todayLogs);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch logs' }); }
});

app.post('/api/logs', async (req, res) => {
  try {
    const logData = { ...req.body, timestamp: new Date().toISOString() };
    if (isMongoConnected) {
      const newFood = new Food(logData);
      await newFood.save();
      return res.json(newFood);
    }
    const db = readLocalDB();
    const newLog = { ...logData, id: Date.now().toString() };
    db.logs.push(newLog);
    writeLocalDB(db);
    res.json(newLog);
  } catch (error) { res.status(500).json({ error: 'Failed to save log' }); }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: isMongoConnected ? 'mongodb' : 'local_json',
    timestamp: new Date().toISOString() 
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image missing' });

    // API Key Safety Check
    if (!process.env.GEMINI_API_KEY) {
      console.error('[Analyze] GEMINI_API_KEY is missing in environment variables.');
      return res.status(500).json({ error: 'Server configuration error: API key missing' });
    }

    const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;

    console.log(`[Analyze] Analyzing image with Gemini 1.5 Flash...`);

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg",
            },
          },
          {
            text: "Analyze this food image. Identify the food name and estimate its nutritional values per serving. Return ONLY a JSON object with food_name, ingredients (array), nutrition (object with calories, protein_g, fat_g, carbs_g, sugar_g, fiber_g), and health_recommendation (object with should_consume and reason)."
          }
        ]
      }],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.2,
      }
    });

    const response = await result.response;
    let text = response.text();
    
    // Clean markdown if present
    text = text.replace(/```json|```/g, "").trim();

    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch (parseError) {
      console.error('JSON Parse Error:', text);
      return res.status(500).json({ error: 'Invalid AI response format' });
    }
  } catch (error) {
    console.error('AI Analysis Error:', error);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// ✅ GLOBAL ERROR HANDLER (Ensures JSON instead of HTML)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global Server Error:', err);
  res.status(err.status || 500).json({ 
    error: 'Internal Server Error', 
    details: err.message || 'An unexpected error occurred on the server.'
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
}
startServer();
