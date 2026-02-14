import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

export async function getEmployees(req: Request, res: Response) {
  try {
    const page = Number(req.query.page ?? 1);
    const size = Number(req.query.size ?? 20);
    const q = String(req.query.q ?? "").trim(); // search name/code/email
    const departmentId = req.query.department_id
      ? Number(req.query.department_id)
      : undefined;

    const where = {
      ...(q
        ? {
            OR: [
              { full_name: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(departmentId ? { department_id: departmentId } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
        include: {
          department: true,
          position: true,
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
    res.status(500).json({ message: "Failed to fetch employees" });
  }
}

export async function getEmployeeById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const item = await prisma.employee.findUnique({
      where: { id },
      include: { department: true, position: true, documents: true },
    });

    if (!item) return res.status(404).json({ message: "Employee not found" });

    res.json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch employee" });
  }
}
