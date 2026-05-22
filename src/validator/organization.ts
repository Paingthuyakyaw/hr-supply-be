import { checkSchema } from "express-validator";

export const payloadSchema = checkSchema(
  {
    name: {
      in: ["body"],
      trim: true,
      notEmpty: { errorMessage: "Name is required" },
      isLength: {
        options: { min: 2, max: 120 },
        errorMessage: "Name must be between 2 and 120 characters",
      },
    },
    ownerEmail: {
      in: ["body"],
      trim: true,
      notEmpty: { errorMessage: "ownerEmail is required" },
      isEmail: {
        errorMessage: "ownerEmail must be a valid email",
      },
      normalizeEmail: true,
    },
    ownerPassword: {
      in: ["body"],
      trim: true,
      notEmpty: { errorMessage: "ownerPassword is required" },
      isLength: {
        options: { min: 6, max: 128 },
        errorMessage: "ownerPassword must be between 6 and 128 characters",
      },
    },
    ownerName: {
      in: ["body"],
      optional: true,
      trim: true,
      isLength: {
        options: { min: 2, max: 120 },
        errorMessage: "ownerName must be between 2 and 120 characters",
      },
    },
    // Prisma field
    total_employees: {
      in: ["body"],
      optional: true,
      isInt: {
        options: { min: 0 },
        errorMessage: "total_employees must be an integer >= 0",
      },
      toInt: true,
    },
    status: {
      in: ["body"],
      trim: true,
      notEmpty: { errorMessage: "Status is required" },
      isIn: {
        options: [["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]],
        errorMessage:
          "Status must be one of PENDING, APPROVED, REJECTED, SUSPENDED",
      },
    },
    planId: {
      in: ["body"],
      notEmpty: { errorMessage: "planId is required" },
      isInt: { errorMessage: "planId must be an integer" },
      toInt: true,
    },
  },
  ["body"],
);
