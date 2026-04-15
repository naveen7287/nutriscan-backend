const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fetch = require("node-fetch"); // ✅ Required for API calls in Node.js

const app = express();

/* ===========================
   ✅ MIDDLEWARE
=========================== */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Support large image uploads (up to 50mb)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
    carbs_g: Number,
    sugar_g: Number,
    fiber_g: Number
  },
  type: String,
  timestamp: {
    type: String,
    default: () => new Date().toISOString()
  },
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
    carbs_g: Number,
    sugar_g: Number,
    fiber_g: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Profile = mongoose.model("Profile", ProfileSchema);

/* ===========================
   🤖 ANALYZE IMAGE API (Hugging Face)
=========================== */
app.post("/api/analyze", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: "Image missing" });
    }

    // Clean base64 prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // API key check
    if (!process.env.HF_API_KEY) {
       console.error("❌ HF_API_KEY is missing");
       return res.status(500).json({ error: "Hugging Face API key missing" });
    }

    // Call Hugging Face (BLIP Model)
    const response = await fetch(
      "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: cleanBase64 })
      }
    );

    const data = await response.json();

    // Handle model loading or rate limits
    if (data.error) {
      console.error("HF ERROR:", data.error);
      return res.status(500).json({ 
        error: "AI model loading or rate limited. Try again in few seconds." 
      });
    }

    const caption = data[0]?.generated_text || "Unknown food";

    // Return structured data (Static nutrition for demo)
    res.json({
      food_name: caption,
      ingredients: [],
      nutrition: {
        calories: 250,
        protein_g: 8,
        fat_g: 10,
        carbs_g: 30,
        sugar_g: 5,
        fiber_g: 3
      },
      confidence: 0.85,
      health_recommendation: {
        should_consume: true,
        reason: "Detected as " + caption + ". General estimation provided."
      }
    });

  } catch (error) {
    console.error("❌ ANALYZE ERROR:", error);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

/* ===========================
   🍽️ FOOD LOGS API
=========================== */
app.post("/api/logs", async (req, res) => {
  try {
    const logData = { ...req.body, timestamp: new Date().toISOString() };
    const newFood = new Food(logData);
    await newFood.save();
    res.json(newFood);
  } catch (error) {
    console.error("Food Save Error:", error);
    res.status(500).json({ error: "Failed to save food data" });
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await Food.find({
      timestamp: { $regex: `^${today}` }
    }).sort({ createdAt: -1 });
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
    const data = { ...req.body };
    delete data._id;

    const profile = await Profile.findOneAndUpdate(
      {},
      data,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(profile);
  } catch (error) {
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
