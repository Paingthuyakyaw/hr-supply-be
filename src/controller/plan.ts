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
    const { code, name } = req.body;

    const data = await prisma.plan.create({
      data: {
        code,
        name,
      },
    });

    return res.status(200).json({
      message: "Created Successfully",
      data,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const editPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name } = req.body;

    const data = await prisma.plan.update({
      where: { id: Number(id) },
      data: {
        code,
        name,
      },
    });
    return res.status(201).json({
      message: "Edit Successfullys",
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};
