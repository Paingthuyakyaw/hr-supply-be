import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

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

    res.json({
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
    res.status(500).json({ message: "Failed to fetch positions" });
  }
}

export async function getPositionById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const item = await prisma.position.findUnique({
      where: { id },
      include: { department: true, employees: true },
    });

    if (!item) return res.status(404).json({ message: "Position not found" });

    res.json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch position" });
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

    res.status(201).json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create position" });
  }
}

export async function updatePosition(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const exists = await prisma.position.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Position not found" });
    }

    const item = await prisma.position.update({
      where: { id },
      data: req.body,
      include: { department: true, employees: true },
    });

    res.json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update position" });
  }
}

export async function deletePosition(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const exists = await prisma.position.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Position not found" });
    }

    await prisma.position.delete({ where: { id } });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete position" });
  }
}
