import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const employee = await prisma.employee.findFirst({
    where: { email },
    include: {
      organization: {
        include: {
          plan: {
            include: {
              menuPermission: true, // Plan က ပေးထားတဲ့ limit
            },
          },
        },
      },
      department: true,
      position: true,
      designations: {
        include: {
          designation: {
            include: {
              menuPermission: {
                include: {
                  menu: true, // ဘယ် Menu တွေ သုံးလို့ရလဲ
                },
              },
            },
          },
        },
      },
    },
  });

  return res.status(200).json({
    message: "Fetch All Data",
    data: employee,
  });
};
