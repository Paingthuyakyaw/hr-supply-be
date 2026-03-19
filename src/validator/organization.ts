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
    // Backward-compat for current clients/validator typo
    total_employment: {
      in: ["body"],
      optional: true,
      isInt: {
        options: { min: 0 },
        errorMessage: "total_employment must be an integer >= 0",
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
    expire_time: {
      in: ["body"],
      optional: true,
      isISO8601: {
        errorMessage: "expire_time must be a valid ISO date string",
      },
      toDate: true,
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
