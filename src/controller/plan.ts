import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

export const getAllPlan = async (req: Request, res: Response) => {
  try {
    const plan = await prisma.plan.findMany();

    return res.status(200).json({
      message: "Fetched Successfully",
      data: plan,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const createPlan = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};
