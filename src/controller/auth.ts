import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcrypt";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/token";

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const employee = await prisma.employee.findFirst({
    where: { email },
    select: {
      email: true,
      password: true,
      id: true,
      organizationId: true,
    },
  });

  if (!employee) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (employee.password) {
    const match = await bcrypt.compare(password, employee.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
  }

  const payload = {
    sub: employee.id,
    orgId: employee.organizationId,
    email: employee.email,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return res.status(200).json({
    message: "Login successful",
    data: employee,
    tokens: {
      accessToken,
      refreshToken,
    },
  });
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const token =
      (req.body && req.body.refreshToken) ||
      (req.query && (req.query.refreshToken as string | undefined));

    if (!token) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: payload.sub },
      include: {
        organization: {
          include: {
            plan: {
              include: {
                menuPermission: {
                  include: {
                    menu: true,
                  },
                },
              },
            },
          },
        },
        department: true,
        positions: {
          include: {
            position: {
              include: {},
            },
          },
        },
        designations: {
          include: {
            designation: {
              include: {
                menuPermission: {
                  include: {
                    menu: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const newPayload = {
      sub: employee.id,
      orgId: employee.organizationId,
      email: employee.email,
    };

    const accessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    return res.status(200).json({
      message: "Token refreshed",
      data: employee,
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to refresh token" });
  }
};
