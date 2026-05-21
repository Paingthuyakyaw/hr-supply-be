import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { sendError, sendSuccess } from "../utils/httpResponse";

export async function getPositions(req: Request, res: Response) {
  try {
    const page = Number(req.query.page ?? 1);
    const size = Number(req.query.size ?? 20);
    const q = String(req.query.q ?? "").trim();
    const departmentId = req.query.department_id
      ? Number(req.query.department_id)
      : undefined;

    const where = {
      ...(departmentId ? { department_id: departmentId } : {}),
      ...(q
        ? {
            name: { contains: q, mode: "insensitive" as const },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.position.count({ where }),
      prisma.position.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
        include: {
          department: true,
        },
      }),
    ]);

    return sendSuccess(res, {
      message: "Positions fetched",
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
    return sendError(res, { message: "Failed to fetch positions", error: err });
  }
}

export async function getPositionById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const item = await prisma.position.findUnique({
      where: { id },
      include: { department: true, employees: true },
    });

    if (!item) {
      return sendError(res, { status: 404, message: "Position not found" });
    }

    return sendSuccess(res, { message: "Position fetched", data: item });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to fetch position", error: err });
  }
}

export async function createPosition(req: Request, res: Response) {
  try {
    const data = req.body;

    const item = await prisma.position.create({
      data,
      include: {
        department: true,
        employees: true,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Position created",
      data: item,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to create position", error: err });
  }
}

export async function updatePosition(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const exists = await prisma.position.findUnique({ where: { id } });
    if (!exists) {
      return sendError(res, { status: 404, message: "Position not found" });
    }

    const item = await prisma.position.update({
      where: { id },
      data: req.body,
      include: { department: true, employees: true },
    });

    return sendSuccess(res, { message: "Position updated", data: item });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to update position", error: err });
  }
}

export async function deletePosition(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid id" });
    }

    const exists = await prisma.position.findUnique({ where: { id } });
    if (!exists) {
      return sendError(res, { status: 404, message: "Position not found" });
    }

    await prisma.position.delete({ where: { id } });

    return sendSuccess(res, {
      message: "Position deleted",
      data: { id },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, { message: "Failed to delete position", error: err });
  }
}
