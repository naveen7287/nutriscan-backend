const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

/* ===========================
   🍛 FOOD SCHEMA (EXISTING)
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
   👤 PROFILE SCHEMA (NEW)
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Profile = mongoose.model("Profile", ProfileSchema);

/* ===========================
   ✅ FOOD SAVE API
=========================== */
app.post("/api/logs", async (req, res) => {
  try {
    console.log("Incoming Food Data:", req.body);

    const newFood = new Food(req.body);
    await newFood.save();

    res.json(newFood);
  } catch (error) {
    console.error("Food Save Error:", error);
    res.status(500).json({ error: "Failed to save food data" });
  }
});

/* ===========================
   ✅ FOOD GET API
=========================== */
app.get("/api/logs", async (req, res) => {
  try {
    const data = await Food.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch food data" });
  }
});

/* ===========================
   👤 PROFILE SAVE API (NEW)
=========================== */
app.post("/api/profile", async (req, res) => {
  try {
    console.log("Incoming Profile Data:", req.body);

    const newProfile = new Profile(req.body);
    await newProfile.save();

    res.json(newProfile);
  } catch (error) {
    console.error("Profile Save Error:", error);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

/* ===========================
   👤 PROFILE GET API (OPTIONAL)
=========================== */
app.get("/api/profile", async (req, res) => {
  try {
    const profile = await Profile.findOne().sort({ createdAt: -1 });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/* ===========================
   🔍 TEST ROUTE
=========================== */
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

/* ===========================
   🚀 SERVER START
=========================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
