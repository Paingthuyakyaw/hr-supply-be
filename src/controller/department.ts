import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { sendError, sendSuccess } from "../utils/httpResponse";

export async function getDepartments(req: Request, res: Response) {
  try {
    const page = Number(req.query.page ?? 1);
    const size = Number(req.query.size ?? 20);
    const q = String(req.query.q ?? "").trim();

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { location: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
        include: {
          positions: true,
          employees: false, // list ထဲ employees မလိုရင် false
        },
      }),
    ]);

    return sendSuccess(res, {
      message: "Departments fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to fetch departments", error: err });
  }
}

export async function getDepartmentById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const item = await prisma.department.findUnique({
      where: { id },
      include: {
        positions: true,
        employees: true,
      },
    });
    if (!item) {
      return sendError(res, { status: 404, message: "Department not found" });
    }

    return sendSuccess(res, { message: "Department fetched", data: item });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to fetch department", error: err });
  }
}

export async function createDepartment(req: Request, res: Response) {
  try {
    const data = req.body;

    const item = await prisma.department.create({
      data,
      include: {
        positions: true,
        employees: false,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Department created",
      data: item,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to create department", error: err });
  }
}

export async function updateDepartment(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const exists = await prisma.department.findUnique({ where: { id } });
    if (!exists) {
      return sendError(res, { status: 404, message: "Department not found" });
    }

    const item = await prisma.department.update({
      where: { id },
      data: req.body,
      include: {
        positions: true,
        employees: true,
      },
    });

    return sendSuccess(res, { message: "Department updated", data: item });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to update department", error: err });
  }
}

export async function deleteDepartment(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const exists = await prisma.department.findUnique({ where: { id } });
    if (!exists) {
      return sendError(res, { status: 404, message: "Department not found" });
    }

    await prisma.department.delete({ where: { id } });

    return sendSuccess(res, {
      message: "Department deleted",
      data: { id },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to delete department", error: err });
  }
}
