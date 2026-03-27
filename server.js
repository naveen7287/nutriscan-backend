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

// Schema
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

// ✅ SAVE API
app.post("/api/logs", async (req, res) => {
  try {
    console.log("Incoming Data:", req.body);

    const newFood = new Food(req.body);
    await newFood.save();

    res.json(newFood);
  } catch (error) {
    console.error("Save Error:", error);
    res.status(500).json({ error: "Failed to save data" });
  }
});

// ✅ GET API (optional)
app.get("/api/logs", async (req, res) => {
  const data = await Food.find().sort({ createdAt: -1 });
  res.json(data);
});

// Test route
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
