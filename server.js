const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config(); // Load environment variables

const app = express();

// Middleware
// Allows your mobile app and AI Studio to talk to this server
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

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
  type: String, // 'homemade' | 'restaurant' | 'manual'
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Food = mongoose.model("Food", FoodSchema);

/* ===========================
   👤 PROFILE SCHEMA (CORRECTED)
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
  // CRITICAL: Added targets field so goals are saved!
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
   ✅ FOOD LOGS API
=========================== */

// Save a new meal log
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

// Get all meal logs (sorted by newest first)
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

// Save or Update Profile
app.post("/api/profile", async (req, res) => {
  try {
    console.log("Saving Profile:", req.body);
    
    // We use findOneAndUpdate to keep only ONE profile record
    // This makes it much cleaner than creating a new profile every time
    const profile = await Profile.findOneAndUpdate(
      {}, // Empty filter matches the first document found
      req.body,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(profile);
  } catch (error) {
    console.error("Profile Save Error:", error);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// Get the latest profile
app.get("/api/profile", async (req, res) => {
  try {
    const profile = await Profile.findOne().sort({ createdAt: -1 });
    // Return empty object if no profile exists yet
    res.json(profile || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/* ===========================
   🔍 SYSTEM ROUTES
=========================== */
app.get("/", (req, res) => {
  res.send("NutriScan Backend is running 🚀");
});

// Health check for Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* ===========================
   🚀 SERVER START
=========================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
