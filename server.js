const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* ===========================
   ✅ MIDDLEWARE (FIXED)
=========================== */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 🔥 IMPORTANT FIX (for image size)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

/* ===========================
   🗄️ MONGODB CONNECTION
=========================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

/* ===========================
   🍛 FOOD SCHEMA
=========================== */
const FoodSchema = new mongoose.Schema({
  food_name: String,
  ingredients: [String],
  nutrition: {
    calories: Number,
    protein_g: Number,
    fat_g: Number,
    carbs_g: Number
  },
  type: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Food = mongoose.model("Food", FoodSchema);

/* ===========================
   👤 PROFILE SCHEMA
=========================== */
const ProfileSchema = new mongoose.Schema({
  name: String,
  age: Number,
  height: Number,
  weight: Number,
  gender: String,
  activityLevel: String,
  healthIssues: String,
  unit: String,
  targets: {
    calories: Number,
    protein_g: Number,
    fat_g: Number,
    carbs_g: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Profile = mongoose.model("Profile", ProfileSchema);

/* ===========================
   🤖 ANALYZE IMAGE API (FIXED)
=========================== */
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

app.post("/analyze", async (req, res) => {
  try {
    const { imageBase64, sourceType, profile } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Image missing" });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this food image. Source: ${sourceType}.
                  Health issues: ${profile?.healthIssues || "None"}.

                  Return STRICT JSON:
                  {
                    "food_name": "",
                    "ingredients": [],
                    "nutrition": {
                      "calories": 0,
                      "protein_g": 0,
                      "fat_g": 0,
                      "carbs_g": 0
                    },
                    "confidence": 0,
                    "health_recommendation": {
                      "should_consume": true,
                      "reason": ""
                    }
                  }`
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: imageBase64
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    // 🔥 Clean Gemini response
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    text = text.replace(/```json|```/g, "").trim();

    const json = JSON.parse(text);

    res.json(json);

  } catch (error) {
    console.error("❌ ANALYZE ERROR:", error);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

/* ===========================
   ✅ FOOD LOGS API
=========================== */
app.post("/api/logs", async (req, res) => {
  try {
    const newFood = new Food(req.body);
    await newFood.save();
    res.json(newFood);
  } catch (error) {
    console.error("Food Save Error:", error);
    res.status(500).json({ error: "Failed to save food data" });
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    const data = await Food.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch food data" });
  }
});

/* ===========================
   👤 PROFILE API
=========================== */
app.post("/api/profile", async (req, res) => {
  try {
    const profile = await Profile.findOneAndUpdate(
      {},
      req.body,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(profile);
  } catch (error) {
    console.error("Profile Save Error:", error);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

app.get("/api/profile", async (req, res) => {
  try {
    const profile = await Profile.findOne().sort({ createdAt: -1 });
    res.json(profile || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/* ===========================
   🚀 SERVER
=========================== */
app.get("/", (req, res) => res.send("NutriScan Backend Running 🚀"));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
