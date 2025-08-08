import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Tesseract from "tesseract.js";
import { Expense } from "../models/expense.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = express.Router();

// Multer config for optional image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Main route: add expense with or without image
router.post(
  "/add",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    let title = req.body.title || "";
    let amount = req.body.amount || "";
    let category = req.body.category || "General";
    let date = req.body.date ? new Date(req.body.date) : new Date();

    // If image is uploaded, extract data
    if (req.file) {
      const imagePath = req.file.path;

      try {
        const { data: { text } } = await Tesseract.recognize(imagePath, "eng");
        fs.unlinkSync(imagePath); // remove uploaded file

        // Extract details only if not already provided in req.body
        if (!title) title = text.split("\n")[0] || "Unknown Expense";
        if (!amount) {
          const amountMatch = text.match(/(\d+(\.\d{1,2})?)/);
          amount = amountMatch ? parseFloat(amountMatch[0]) : 0;
        }
        if (!req.body.date) {
          const dateMatch = text.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/);
          date = dateMatch ? new Date(dateMatch[0]) : new Date();
        }
      } catch (error) {
        throw new ApiError(500, "Error extracting text from image");
      }
    }

    // Final check before saving
    if (!title || !amount) {
      throw new ApiError(400, "Title and amount are required");
    }

    // Save to MongoDB
    const expense = await Expense.create({ title, amount, category, date });

    res.status(201).json(
      new ApiResponse(201, expense, "Expense added successfully")
    );
  })
);

export default router;
