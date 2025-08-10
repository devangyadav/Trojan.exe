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

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

/**
 * @desc Add expense with or without image
 */
router.post(
  "/add",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    let title = req.body.title || "";
    let amount = req.body.amount || "";
    let category = req.body.category || "General";
    let date = req.body.date ? new Date(req.body.date) : new Date();

    // If image uploaded → OCR processing
    if (req.file) {
      const imagePath = req.file.path;
      try {
        const { data: { text } } = await Tesseract.recognize(imagePath, "eng");
        fs.unlinkSync(imagePath); // delete file after processing

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

    if (!title || !amount) {
      throw new ApiError(400, "Title and amount are required");
    }

    const expense = await Expense.create({ title, amount, category, date });

    res.status(201).json(new ApiResponse(201, expense, "Expense added successfully"));
  })
);

/**
 * @desc Get all expenses
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(new ApiResponse(200, expenses, "Expenses fetched successfully"));
  })
);

/**
 * @desc Generate reports
 */
router.get(
  "/report/:type",
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const now = new Date();
    let startDate;

    if (type === "daily") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (type === "weekly") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else if (type === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (type === "yearly") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      throw new ApiError(400, "Invalid report type");
    }

    const expenses = await Expense.find({ date: { $gte: startDate } }).sort({ date: -1 });
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    res.json(new ApiResponse(200, { expenses, total }, `${type} report generated successfully`));
  })
);

/**
 * @desc Edit expense
 */
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, amount, category, date } = req.body;

    const expense = await Expense.findByIdAndUpdate(
      id,
      { title, amount, category, date },
      { new: true }
    );

    if (!expense) {
      throw new ApiError(404, "Expense not found");
    }

    res.json(new ApiResponse(200, expense, "Expense updated successfully"));
  })
);

/**
 * @desc Delete expense
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const expense = await Expense.findByIdAndDelete(id);

    if (!expense) {
      throw new ApiError(404, "Expense not found");
    }

    res.json(new ApiResponse(200, null, "Expense deleted successfully"));
  })
);

export default router;
