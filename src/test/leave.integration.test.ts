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
  email: "leave@test.com",
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
  prismaMock.leaveType.findFirst = async () => null;
  prismaMock.organization.findUnique = async () => null;
  prismaMock.holidayCalendar.findMany = async () => [];
  prismaMock.leaveRequest.findFirst = async () => null;
  prismaMock.leaveRequest.findMany = async () => [];
  prismaMock.leaveRequest.count = async () => 0;
  prismaMock.leaveBalance.findMany = async () => [];
  prismaMock.leaveBalance.findUnique = async () => null;
  prismaMock.$transaction = async (callback: (tx: any) => Promise<any>) => {
    const tx = {
      leaveBalance: {
        findUnique: async () => null,
        create: async (args: any) => ({ id: 11, ...args.data }),
        update: async (args: any) => ({ id: args.where.id, ...args.data }),
        upsert: async (args: any) => ({ id: 50, ...args.create }),
      },
      leaveRequest: {
        create: async (args: any) => ({ id: 101, ...args.data }),
        update: async (args: any) => ({ id: args.where.id, ...args.data }),
      },
    };
    return callback(tx);
  };
});

describe("leave integration", () => {
  test("POST /api/leave/requests creates request with holiday/off-day excluded", async () => {
    prismaMock.leaveType.findFirst = async () => ({
      id: 2,
      organizationId: 10,
      annualQuotaDays: 14,
      carryForwardLimit: 5,
      requiresApproval: true,
      isActive: true,
    });
    prismaMock.organization.findUnique = async () => ({
      id: 10,
      off_days: ["SAT", "SUN"],
    });
    prismaMock.holidayCalendar.findMany = async () => [
      { date: new Date("2026-06-02T00:00:00.000Z") },
    ];
    prismaMock.$transaction = async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        leaveBalance: {
          findUnique: async () => null,
          create: async () => ({
            id: 40,
            remainingDays: 14,
          }),
        },
        leaveRequest: {
          create: async (args: any) => ({
            id: 101,
            ...args.data,
            leaveType: { id: 2, code: "ANNUAL", name: "Annual Leave" },
          }),
        },
      };
      return callback(tx);
    };

    const res = await request(app)
      .post("/api/leave/requests")
      .set(authHeader)
      .send({
        leaveTypeId: 2,
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        reason: "Family matter",
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Leave request created");
    assert.equal(res.body.data.totalDays, 2);
    assert.equal(res.body.data.status, "PENDING");
  });

  test("POST /api/admin/leave/requests/:id/decision approves and deducts balance", async () => {
    prismaMock.leaveRequest.findFirst = async () => ({
      id: 90,
      organizationId: 10,
      employeeId: 1,
      leaveTypeId: 2,
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      totalDays: 2,
      status: "PENDING",
      leaveType: { id: 2, annualQuotaDays: 14 },
    });
    prismaMock.$transaction = async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        leaveBalance: {
          findUnique: async () => ({
            id: 40,
            remainingDays: 5,
          }),
          update: async () => ({
            id: 40,
            usedDays: 2,
            remainingDays: 3,
          }),
        },
        leaveRequest: {
          update: async (args: any) => ({
            id: args.where.id,
            status: args.data.status,
          }),
        },
      };
      return callback(tx);
    };

    const res = await request(app)
      .post("/api/admin/leave/requests/90/decision")
      .set(authHeader)
      .send({ decision: "APPROVE", comment: "Approved" });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "APPROVED");
  });

  test("POST /api/admin/leave/carry-forward creates next-year balances", async () => {
    prismaMock.leaveBalance.findMany = async () => [
      {
        id: 1,
        employeeId: 1,
        leaveTypeId: 2,
        remainingDays: 8,
        leaveType: {
          id: 2,
          annualQuotaDays: 14,
          carryForwardLimit: 5,
        },
      },
    ];

    let upsertCalled = false;
    prismaMock.$transaction = async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        leaveBalance: {
          upsert: async () => {
            upsertCalled = true;
            return {};
          },
        },
      };
      return callback(tx);
    };

    const res = await request(app)
      .post("/api/admin/leave/carry-forward")
      .set(authHeader)
      .send({ fromYear: 2026 });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Leave carry-forward completed");
    assert.equal(res.body.data.toYear, 2027);
    assert.equal(upsertCalled, true);
  });

  test("POST /api/admin/leave/holidays creates holiday", async () => {
    prismaMock.holidayCalendar.create = async (args: any) => ({
      id: 77,
      ...args.data,
    });

    const res = await request(app)
      .post("/api/admin/leave/holidays")
      .set(authHeader)
      .send({
        date: "2026-12-25",
        name: "Christmas Day",
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Holiday created");
    assert.equal(res.body.data.name, "Christmas Day");
  });
});
