import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, default: "General" },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const Expense = mongoose.model("Expense", expenseSchema);
