import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

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
    res.status(500).json({ message: "Failed to fetch departments" });
  }
}

export async function getDepartmentById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const item = await prisma.department.findUnique({
      where: { id },
      include: {
        positions: true,
        employees: true,
      },
    });
    if (!item) return res.status(404).json({ message: "Department not found" });

    res.json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch department" });
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

    res.status(201).json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create department" });
  }
}

export async function updateDepartment(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const exists = await prisma.department.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Department not found" });
    }

    const item = await prisma.department.update({
      where: { id },
      data: req.body,
      include: {
        positions: true,
        employees: true,
      },
    });

    res.json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update department" });
  }
}

export async function deleteDepartment(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const exists = await prisma.department.findUnique({ where: { id } });
    if (!exists) {
      return res.status(404).json({ message: "Department not found" });
    }

    await prisma.department.delete({ where: { id } });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete department" });
  }
}
