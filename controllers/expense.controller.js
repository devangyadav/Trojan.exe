// controllers/expense.controller.js
import { Expense } from "../models/expense.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiResponse.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import mongoose from "mongoose";

// ========================== ADD EXPENSE ==========================
export const addExpense = asyncHandler(async (req, res) => {
  const { title, amount, category, date } = req.body;

  if (!title || !amount) {
    throw new ApiError(400, "Title and amount are required");
  }

  const expense = await Expense.create({
    title,
    amount,
    category,
    date: date || new Date(),
  });

  return res
    .status(201)
    .json(new ApiResponse(201, expense, "Expense added successfully"));
});

// ========================== EDIT EXPENSE ==========================
export const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, amount, category, date } = req.body;

  const expense = await Expense.findByIdAndUpdate(
    id,
    { title, amount, category, date },
    { new: true }
  );

  if (!expense) throw new ApiError(404, "Expense not found");

  return res
    .status(200)
    .json(new ApiResponse(200, expense, "Expense updated successfully"));
});

// ========================== DELETE EXPENSE ==========================
export const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const expense = await Expense.findByIdAndDelete(id);

  if (!expense) throw new ApiError(404, "Expense not found");

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Expense deleted successfully"));
});

// ========================== GET EXPENSES BY PERIOD ==========================
export const getExpensesByDay = asyncHandler(async (req, res) => {
  const { date } = req.query; // format: YYYY-MM-DD
  if (!date) throw new ApiError(400, "Date is required");

  const start = new Date(date);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const expenses = await Expense.find({
    date: { $gte: start, $lte: end },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, expenses, "Expenses for the day fetched"));
});

export const getExpensesByWeek = asyncHandler(async (req, res) => {
  const { weekStart } = req.query; // format: YYYY-MM-DD
  if (!weekStart) throw new ApiError(400, "Week start date is required");

  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const expenses = await Expense.find({
    date: { $gte: start, $lte: end },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, expenses, "Weekly expenses fetched"));
});

export const getExpensesByMonth = asyncHandler(async (req, res) => {
  const { month, year } = req.query; // month: 1-12, year: YYYY
  if (!month || !year) throw new ApiError(400, "Month and year are required");

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const expenses = await Expense.find({
    date: { $gte: start, $lte: end },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, expenses, "Monthly expenses fetched"));
});

export const getExpensesByYear = asyncHandler(async (req, res) => {
  const { year } = req.query; // YYYY
  if (!year) throw new ApiError(400, "Year is required");

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);

  const expenses = await Expense.find({
    date: { $gte: start, $lte: end },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, expenses, "Yearly expenses fetched"));
});

// ========================== REPORT GENERATION ==========================
export const generateReport = asyncHandler(async (req, res) => {
  const { period, startDate, endDate } = req.query;

  let matchCondition = {};

  if (period === "custom") {
    if (!startDate || !endDate) throw new ApiError(400, "Dates required");
    matchCondition.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  } else if (period === "month") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    matchCondition.date = { $gte: start, $lte: end };
  } else if (period === "year") {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    matchCondition.date = { $gte: start, $lte: end };
  }

  const report = await Expense.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: "$category",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, report, "Report generated successfully"));
});
