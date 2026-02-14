import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

export async function getPositions(req: Request, res: Response) {
  try {
    const departmentId = req.query.department_id
      ? Number(req.query.department_id)
      : undefined;

    const where = departmentId ? { department_id: departmentId } : {};

    const items = await prisma.position.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        department: true,
      },
    });

    res.json({ data: items });
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
