import z from "zod";
import { WeekDay } from "../generated/prisma/enums";

const idParam = z.string().regex(/^\d+$/, { message: "id must be a positive integer" });
const weekdaySchema = z.nativeEnum(WeekDay);

const hasUniqueValues = (values: WeekDay[]) =>
  new Set(values).size === values.length;

export const organizationScheduleParamSchema = z.object({
  params: z.object({
    id: idParam,
  }),
});

export const updateOrganizationScheduleSchema = z.object({
  params: z.object({
    id: idParam,
  }),
  body: z
    .object({
      workingDays: z.array(weekdaySchema).optional(),
      offDays: z.array(weekdaySchema).optional(),
    })
    .refine(
      (body) =>
        Array.isArray(body.workingDays) || Array.isArray(body.offDays),
      { message: "workingDays or offDays is required" },
    )
    .refine(
      (body) => !body.workingDays || hasUniqueValues(body.workingDays),
      { message: "workingDays must contain unique values" },
    )
    .refine((body) => !body.offDays || hasUniqueValues(body.offDays), {
      message: "offDays must contain unique values",
    })
    .refine((body) => {
      if (!body.workingDays || !body.offDays) return true;
      const workingSet = new Set(body.workingDays);
      return !body.offDays.some((day) => workingSet.has(day));
    }, { message: "workingDays and offDays cannot overlap" }),
});
