import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import request from "supertest";
import app from "../index";
import { prisma } from "../../lib/prisma";
import { Action, EmployeeStatus } from "../generated/prisma/enums";
import { signAccessToken } from "../utils/token";

const prismaMock = prisma as any;

const accessToken = signAccessToken({
  sub: 1,
  orgId: 10,
  email: "workflow@test.com",
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
  prismaMock.employee.findFirst = async () => null;
  prismaMock.employee.update = async () => null;
  prismaMock.employeeContract.findMany = async () => [];
  prismaMock.employeeContract.aggregate = async () => ({ _max: { version: 0 } });
  prismaMock.employeeContract.create = async () => null;
  prismaMock.organization.update = async () => null;
  prismaMock.approvalRequest.findFirst = async () => null;
});

describe("workflow foundation integration", () => {
  test("PATCH /api/employees/:id/lifecycle blocks invalid transition", async () => {
    prismaMock.employee.findFirst = async () => ({
      id: 1,
      status: EmployeeStatus.RESIGNED,
    });

    const res = await request(app)
      .patch("/api/admin/employees/1/lifecycle")
      .set(authHeader)
      .send({ status: EmployeeStatus.ACTIVE });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /Invalid employee status transition/);
  });

  test("POST /api/employees/:id/contracts creates next version", async () => {
    prismaMock.employee.findFirst = async () => ({ id: 1, organizationId: 10 });
    prismaMock.employeeContract.aggregate = async () => ({ _max: { version: 2 } });
    prismaMock.employeeContract.create = async (args: any) => ({
      id: 12,
      employeeId: 1,
      fileUrl: args.data.fileUrl,
      version: args.data.version,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post("/api/admin/employees/1/contracts")
      .set(authHeader)
      .send({ fileUrl: "https://files.example.com/contracts/v3.pdf" });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.version, 3);
  });

  test("PUT /api/organization/:id/schedule updates weekday policy", async () => {
    prismaMock.organization.update = async () => ({
      id: 10,
      working_days: ["MON", "TUE", "WED", "THU", "FRI"],
      off_days: ["SAT", "SUN"],
    });

    const res = await request(app)
      .put("/api/admin/organization/10/schedule")
      .set(authHeader)
      .send({
        workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
        offDays: ["SAT", "SUN"],
      });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.offDays, ["SAT", "SUN"]);
  });

  test("POST /api/admin/attendance/approvals/:id/decision enforces current-step approver", async () => {
    prismaMock.approvalRequest.findFirst = async () => ({
      id: 55,
      organizationId: 10,
      currentStep: 1,
      status: "PENDING",
      steps: [{ id: 500, stepOrder: 1, status: "PENDING", approverId: 99 }],
    });

    const res = await request(app)
      .post("/api/admin/attendance/approvals/55/decision")
      .set(authHeader)
      .send({ decision: "APPROVE" });

    assert.equal(res.status, 403);
    assert.equal(res.body.message, "You are not allowed to approve this step");
  });

  test("POST /api/attendance/approvals rejects legacy LEAVE type", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .set(authHeader)
      .send({
        type: "LEAVE",
        payload: {
          leaveType: "ANNUAL",
          fromDate: "2026-06-01",
          toDate: "2026-06-03",
          reason: "Legacy leave flow",
        },
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Validation Error");
  });
});
