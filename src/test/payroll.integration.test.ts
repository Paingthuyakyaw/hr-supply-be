import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import request from "supertest";
import app from "../index";
import { prisma } from "../../lib/prisma";
import { Action } from "../generated/prisma/enums";
import { signAccessToken } from "../utils/token";

const prismaMock = prisma as any;

const accessToken = signAccessToken({
  sub: 1,
  orgId: 10,
  email: "payroll@test.com",
});

const authHeader = { Authorization: `Bearer ${accessToken}` };

const allowAllPermissions = () => {
  prismaMock.employee.findUnique = async () => ({
    organization: {
      plan: {
        menuPermission: [
          {
            actions: [Action.VIEW, Action.CREATE, Action.UPDATE, Action.DELETE],
          },
        ],
      },
    },
    designations: [],
  });
};

beforeEach(() => {
  allowAllPermissions();
  prismaMock.payrollComponent.findMany = async () => [];
  prismaMock.payrollComponent.findFirst = async () => null;
  prismaMock.payrollComponent.create = async (args: any) => ({
    id: 1,
    ...args.data,
  });
  prismaMock.payrollComponent.update = async (args: any) => ({
    id: args.where.id,
    ...args.data,
  });
  prismaMock.employee.findMany = async () => [];
  prismaMock.payrollRun.findFirst = async () => null;
  prismaMock.payrollRun.findMany = async () => [];
  prismaMock.payrollRun.count = async () => 0;
  prismaMock.payrollRun.update = async (args: any) => ({
    id: args.where.id,
    ...args.data,
  });
  prismaMock.$transaction = async (callback: (tx: any) => Promise<any>) => {
    const tx = {
      payrollRun: {
        upsert: async () => ({
          id: 22,
          organizationId: 10,
          month: "2026-06",
          status: "DRAFT",
        }),
      },
      payrollItem: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async () => ({ count: 0 }),
        groupBy: async () => [],
      },
    };
    return callback(tx);
  };
});

describe("payroll integration", () => {
  test("POST /api/admin/payroll/components creates component", async () => {
    const res = await request(app)
      .post("/api/admin/payroll/components")
      .set(authHeader)
      .send({
        code: "BASIC",
        name: "Basic Salary",
        type: "EARNING",
        calculationType: "FIXED",
        value: 500000,
        isTaxable: true,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Payroll component created");
    assert.equal(res.body.data.code, "BASIC");
  });

  test("POST /api/admin/payroll/runs creates payroll run", async () => {
    prismaMock.employee.findMany = async () => [
      {
        id: 1,
        code: "EMP-001",
        full_name: "Staff One",
        positions: [{ position: { avg_salary: 1000000 } }],
      },
    ];
    prismaMock.payrollComponent.findMany = async () => [
      {
        id: 1,
        type: "EARNING",
        calculationType: "FIXED",
        value: 600000,
      },
      {
        id: 2,
        type: "DEDUCTION",
        calculationType: "PERCENTAGE",
        value: 5,
      },
    ];
    prismaMock.$transaction = async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        payrollRun: {
          upsert: async () => ({
            id: 88,
            organizationId: 10,
            month: "2026-06",
            status: "DRAFT",
          }),
        },
        payrollItem: {
          deleteMany: async () => ({ count: 0 }),
          createMany: async () => ({ count: 2 }),
          groupBy: async () => [{ employeeId: 1, _sum: { amount: 550000 } }],
        },
      };
      return callback(tx);
    };

    const res = await request(app)
      .post("/api/admin/payroll/runs")
      .set(authHeader)
      .send({ month: "2026-06", notes: "June run" });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Payroll run completed");
    assert.equal(res.body.data.run.id, 88);
  });

  test("GET /api/admin/payroll/runs/:id/summary returns run totals", async () => {
    prismaMock.payrollRun.findFirst = async () => ({
      id: 90,
      organizationId: 10,
      month: "2026-06",
      status: "DRAFT",
      notes: null,
      processedAt: new Date(),
      items: [
        {
          id: 1,
          employeeId: 1,
          amount: 600000,
          employee: { id: 1, code: "EMP-001", full_name: "Staff One" },
          component: { id: 1, code: "BASIC", name: "Basic", type: "EARNING" },
        },
        {
          id: 2,
          employeeId: 1,
          amount: -50000,
          employee: { id: 1, code: "EMP-001", full_name: "Staff One" },
          component: { id: 2, code: "TAX", name: "Tax", type: "DEDUCTION" },
        },
      ],
    });

    const res = await request(app)
      .get("/api/admin/payroll/runs/90/summary")
      .set(authHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Payroll summary fetched");
    assert.equal(res.body.data.totals.totalNetPay, 550000);
  });

  test("POST /api/admin/payroll/runs/:id/export returns csv content", async () => {
    prismaMock.payrollRun.findFirst = async () => ({
      id: 90,
      organizationId: 10,
      month: "2026-06",
      items: [
        {
          id: 1,
          employeeId: 1,
          amount: 600000,
          employee: { id: 1, code: "EMP-001", full_name: "Staff One" },
          component: { id: 1, code: "BASIC", name: "Basic", type: "EARNING" },
        },
      ],
    });

    const res = await request(app)
      .post("/api/admin/payroll/runs/90/export")
      .set(authHeader)
      .send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Payroll export generated");
    assert.match(res.body.data.content, /employee_code,employee_name/);
  });
});
