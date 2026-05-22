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
  clientType: "admin",
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
  prismaMock.payrollRun.findUnique = async () => null;
  prismaMock.payrollEmployeeSummary.findMany = async () => [];
  prismaMock.payrollEmployeeSummary.findFirst = async () => null;
  prismaMock.payrollEmployeeSummary.update = async (args: any) => ({
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
      payrollEmployeeSummary: {
        deleteMany: async () => ({ count: 0 }),
        create: async (args: any) => ({
          id: 1001,
          status: "PROCESSED",
          ...args.data,
        }),
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
        payrollEmployeeSummary: {
          deleteMany: async () => ({ count: 0 }),
          create: async (args: any) => ({
            id: 401,
            status: "PROCESSED",
            ...args.data,
          }),
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
      employeeSummaries: [
        {
          id: 1,
          employeeId: 1,
          netPay: 550000,
          status: "PROCESSED",
          employee: { id: 1, code: "EMP-001", full_name: "Staff One" },
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
      employeeSummaries: [
        {
          id: 1,
          employeeId: 1,
          basicSalary: 600000,
          totalAllowances: 600000,
          totalDeductions: 50000,
          netPay: 550000,
          status: "PROCESSED",
          employee: { id: 1, code: "EMP-001", full_name: "Staff One" },
        },
      ],
    });

    const res = await request(app)
      .post("/api/admin/payroll/runs/90/export")
      .set(authHeader)
      .send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Payroll export generated");
    assert.match(res.body.data.content, /basic_salary,allowances,deductions,net_pay,status/);
  });

  test("GET /api/admin/payroll/overview returns dashboard cards and rows", async () => {
    prismaMock.payrollRun.findUnique = async () => ({
      id: 77,
      month: "2026-12",
      status: "DRAFT",
      processedAt: new Date(),
    });
    prismaMock.payrollEmployeeSummary.findMany = async () => [
      {
        id: 1,
        basicSalary: 100000,
        totalAllowances: 120000,
        totalDeductions: 10000,
        netPay: 110000,
        status: "PROCESSED",
        paidAt: null,
        employee: {
          id: 1,
          code: "EMP-001",
          full_name: "Staff One",
          department: { id: 5, name: "Engineering" },
        },
      },
      {
        id: 2,
        basicSalary: 100000,
        totalAllowances: 110000,
        totalDeductions: 10000,
        netPay: 100000,
        status: "PAID",
        paidAt: new Date(),
        employee: {
          id: 2,
          code: "EMP-002",
          full_name: "Staff Two",
          department: { id: 5, name: "Engineering" },
        },
      },
    ];

    const res = await request(app)
      .get("/api/admin/payroll/overview")
      .set(authHeader)
      .query({ month: "2026-12", page: 1, size: 20 });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.cards.totalPayroll, 210000);
    assert.equal(res.body.data.cards.paid, 1);
    assert.equal(res.body.data.cards.processed, 1);
  });

  test("GET /api/admin/payroll/calculate/options returns employee and component options", async () => {
    prismaMock.employee.findMany = async () => [
      {
        id: 1,
        code: "EMP-001",
        full_name: "Staff One",
        department: { id: 1, name: "Engineering" },
        positions: [{ position: { avg_salary: 100000 } }],
      },
    ];
    prismaMock.payrollComponent.findMany = async () => [
      { id: 1, type: "EARNING" },
      { id: 2, type: "DEDUCTION" },
    ];
    prismaMock.payrollRun.findUnique = async () => ({ id: 22 });

    const res = await request(app)
      .get("/api/admin/payroll/calculate/options")
      .set(authHeader)
      .query({ month: "2026-12" });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.hasPayrollRun, true);
    assert.equal(res.body.data.employees.length, 1);
    assert.equal(res.body.data.allowances.length, 1);
    assert.equal(res.body.data.deductions.length, 1);
  });

  test("POST /api/admin/payroll/employees/:employeeId/calculate calculates one employee payroll", async () => {
    prismaMock.employee.findFirst = async () => ({
      id: 1,
      code: "EMP-001",
      full_name: "Staff One",
      positions: [{ position: { avg_salary: 100000 } }],
    });
    prismaMock.payrollComponent.findMany = async () => [
      { id: 1, organizationId: 10, type: "EARNING" },
      { id: 2, organizationId: 10, type: "DEDUCTION" },
    ];
    prismaMock.$transaction = async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        payrollRun: {
          upsert: async () => ({ id: 99, month: "2026-12", status: "DRAFT" }),
        },
        payrollItem: {
          deleteMany: async () => ({ count: 0 }),
          createMany: async () => ({ count: 2 }),
        },
        payrollEmployeeSummary: {
          deleteMany: async () => ({ count: 0 }),
          create: async (args: any) => ({ id: 401, ...args.data }),
        },
      };
      return callback(tx);
    };

    const res = await request(app)
      .post("/api/admin/payroll/employees/1/calculate")
      .set(authHeader)
      .send({
        month: "2026-12",
        allowances: [{ componentId: 1, amount: 120000 }],
        deductions: [{ componentId: 2, amount: 20000 }],
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Employee payroll calculated");
    assert.equal(res.body.data.run.id, 99);
  });

  test("POST /api/admin/payroll/employees/:employeeId/pay marks payroll paid", async () => {
    prismaMock.payrollRun.findUnique = async () => ({ id: 88 });
    prismaMock.payrollEmployeeSummary.findFirst = async () => ({
      id: 19,
      status: "PROCESSED",
    });
    prismaMock.payrollEmployeeSummary.update = async () => ({
      id: 19,
      status: "PAID",
    });

    const res = await request(app)
      .post("/api/admin/payroll/employees/1/pay")
      .set(authHeader)
      .send({ month: "2026-12" });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Payroll marked as paid");
    assert.equal(res.body.data.status, "PAID");
  });
});
