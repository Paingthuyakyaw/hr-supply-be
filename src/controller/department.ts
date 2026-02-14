import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

export async function getDepartments(req: Request, res: Response) {
  try {
    const isActive = req.query.is_active;
    const where =
      typeof isActive === "string" ? { is_active: isActive === "true" } : {};

    const items = await prisma.department.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        positions: true,
        employees: false, // list ထဲ employees မလိုရင် false
      },
    });

    res.json({ data: items });
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
