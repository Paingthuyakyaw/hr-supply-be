import z from "zod";
import { AttendanceRecordState, WeekDay } from "../generated/prisma/enums";

const idParam = z.string().regex(/^\d+$/, { message: "id must be a positive integer" });
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" });
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Time must be HH:mm" });

export const attendanceCheckInSchema = z.object({
  body: z.object({
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const attendanceCheckOutSchema = z.object({
  body: z.object({
    notes: z.string().trim().max(1000).optional(),
  }),
});

export const attendanceMyRecordListSchema = z.object({
  query: z.object({
    from: dateString.optional(),
    to: dateString.optional(),
    state: z.nativeEnum(AttendanceRecordState).optional(),
    page: z.coerce.number().int().min(1).optional(),
    size: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const attendancePolicySchema = z.object({
  body: z.object({
    defaultStartTime: timeString,
    defaultEndTime: timeString,
    lateGraceMinutes: z.number().int().min(0).max(180).default(10),
    earlyLeaveGraceMinutes: z.number().int().min(0).max(180).default(10),
    minHalfDayMinutes: z.number().int().min(30).max(720).default(240),
  }),
});

export const attendanceShiftCreateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    weekdays: z.array(z.nativeEnum(WeekDay)).min(1).max(7),
    startTime: timeString,
    endTime: timeString,
    lateGraceMinutes: z.number().int().min(0).max(180).optional(),
    earlyLeaveGraceMinutes: z.number().int().min(0).max(180).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  }),
});

export const attendanceShiftUpdateSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      weekdays: z.array(z.nativeEnum(WeekDay)).min(1).max(7).optional(),
      startTime: timeString.optional(),
      endTime: timeString.optional(),
      lateGraceMinutes: z.number().int().min(0).max(180).optional(),
      earlyLeaveGraceMinutes: z.number().int().min(0).max(180).optional(),
      isActive: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field is required",
    }),
});

export const attendanceRecordListSchema = z.object({
  query: z.object({
    employeeId: z.coerce.number().int().positive().optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    state: z.nativeEnum(AttendanceRecordState).optional(),
    page: z.coerce.number().int().min(1).optional(),
    size: z.coerce.number().int().min(1).max(100).optional(),
  }),
});
