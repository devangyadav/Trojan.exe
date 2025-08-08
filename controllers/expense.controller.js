import { Expense } from "../models/expense.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const addExpense = asyncHandler(async (req, res) => {
  const { title, amount, category } = req.body;

  if (!title || !amount) {
    throw new ApiError(400, "Title and amount are required");
  }

  const expense = await Expense.create({ title, amount, category });

  return res
    .status(201)
    .json(new ApiResponse(201, expense, "Expense added successfully"));
});
