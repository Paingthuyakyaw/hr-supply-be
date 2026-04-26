import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import type { OrganizationStatus } from "../generated/prisma/enums";
import { formatCode } from "../utils/format";

export const getAllOrg = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page ?? 1);
    const size = Number(req.query.size ?? 20);
    const q = String(req.query.q ?? "").trim();
    const status =
      (req.query.status as OrganizationStatus | undefined) ?? undefined;

    const where = {
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          total_employees: true,
          status: true,
          expire_time: true,
          code: true,
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    return res.status(200).json({
      message: "Organization Fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something Wrong",
      error: err,
    });
  }
};

export const createOrg = async (req: Request, res: Response) => {
  try {
    const v = (req as any).validated ?? req.body;

    const totalEmployees =
      typeof v.total_employees !== "undefined"
        ? Number(v.total_employees)
        : typeof v.total_employment !== "undefined"
          ? Number(v.total_employment)
          : undefined;

    const data = await prisma.$transaction(async (tx) => {
      const counter = await tx.codeCounter.upsert({
        where: { key: "Organization" },
        create: { key: "Organization", value: 1 },
        update: { value: { increment: 1 } },
      });

      return await tx.organization.create({
        data: {
          name: v.name,
          code: formatCode("ORG", counter.value),
          total_employees: totalEmployees ?? 0,
          status: v.status,
          expire_time: v.expire_time ?? undefined,
          planId: v.planId,
        },
      });
    });

    return res.status(201).json({
      message: "Organization Created",
      data,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something Wrong",
      error: err,
    });
  }
};

export const editOrganization = async (req: Request, res: Response) => {
  console.log(req.params);

  try {
    const { id } = req.params;
    const { name, total_employees, status, expire_time, planId } = req.body;

    const existing = await prisma.organization.findUnique({
      where: { id: Number(id) },
      select: { id: true },
    });

    const data = await prisma.organization.update({
      where: {
        id: Number(id),
      },
      data: {
        name,
        total_employees: total_employees,
        status,
        expire_time,
        planId,
      },
    });

    return res.status(201).json({
      message: "Organization Edit Successfully",
      data,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something Wrong",
      error: err,
    });
  }
};
