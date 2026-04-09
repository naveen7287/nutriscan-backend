const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// MongoDB Connection
// Render will provide process.env.MONGO_URI from your Environment settings
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
   🚀 SERVER START
=========================== */
app.get("/", (req, res) => res.send("NutriScan Backend is running 🚀"));
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
