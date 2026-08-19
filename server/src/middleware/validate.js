import { validationResult } from "express-validator";

// Check for validation errors and return 400 if any
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array().map((err) => err.msg).join(". "),
      errors: errors.array(),
    });
  }
  next();
};
