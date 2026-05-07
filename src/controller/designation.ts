import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

export const getDesignation = async (req: Request, res: Response) => {
  try {
    const { search, page = 1, size = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(size);
    const limit = Number(size);

    const designation = await prisma.designation.findMany({
      where: {
        name: {
          contains: search?.toString(),
          mode: "insensitive",
        },
      },
      include: {
        _count: {
          select: { menuPermission: true },
        },
        organization: {
          select: {
            name: true,
          },
        },
      },
      skip,
      take: limit,
    });

    const totalItems = await prisma.designation.count({
      where: {
        name: {
          contains: search?.toString(),
          mode: "insensitive",
        },
      },
    });

    return res.status(200).json({
      message: "Designation Fetch all",
      data: designation.map((da) => ({
        id: da.id,
        name: da.name,
        menuPermission: da._count.menuPermission,
        organization: da.organization,
        organizationId: da.organizationId,
      })),
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        page: Number(page),
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server Error",
      error: err,
    });
  }
};
