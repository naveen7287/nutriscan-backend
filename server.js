const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const Food = mongoose.model("Food", {
  name: String,
  calories: Number,
  protein: Number
});

app.post("/api/save", async (req, res) => {
  try {
    const food = new Food(req.body);
    await food.save();
    res.json({ message: "Saved successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Backend running");
});

app.listen(5000, () => console.log("Server started"));
