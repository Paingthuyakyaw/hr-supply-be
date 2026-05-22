import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import request from "supertest";
import app from "../index";
import { prisma } from "../../lib/prisma";
import { Action, EmployeeStatus, PlatformPermission } from "../generated/prisma/enums";
import { signAccessToken } from "../utils/token";

const prismaMock = prisma as any;

const adminAccessToken = signAccessToken({
  sub: 1,
  orgId: 10,
  email: "workflow@test.com",
  clientType: "admin",
});
const mobileAccessToken = signAccessToken({
  sub: 1,
  orgId: 10,
  email: "workflow-mobile@test.com",
  clientType: "mobile",
});
const superadminAccessToken = signAccessToken({
  sub: 99,
  orgId: 0,
  email: "superadmin@test.com",
  clientType: "admin",
  adminScope: "SUPERADMIN",
  actorType: "platform",
});

const adminAuthHeader = { Authorization: `Bearer ${adminAccessToken}` };
const mobileAuthHeader = { Authorization: `Bearer ${mobileAccessToken}` };
const superadminAuthHeader = { Authorization: `Bearer ${superadminAccessToken}` };

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
  prismaMock.platformUser.findUnique = async () => ({
    isActive: true,
    permissions: [PlatformPermission.APPROVAL_VIEW, PlatformPermission.APPROVAL_DECIDE],
  });
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
      .set(adminAuthHeader)
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
      .set(adminAuthHeader)
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
      .set(adminAuthHeader)
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
      .set(adminAuthHeader)
      .send({ decision: "APPROVE" });

    assert.equal(res.status, 403);
    assert.equal(res.body.message, "You are not allowed to approve this step");
  });

  test("POST /api/admin/attendance/approvals/:id/decision blocks superadmin on org-scoped step", async () => {
    prismaMock.approvalRequest.findFirst = async () => ({
      id: 56,
      organizationId: 10,
      currentStep: 1,
      status: "PENDING",
      steps: [
        {
          id: 501,
          stepOrder: 1,
          scope: "ORG",
          status: "PENDING",
          approverId: 2,
          platformApproverId: null,
        },
      ],
    });

    const res = await request(app)
      .post("/api/admin/attendance/approvals/56/decision")
      .set(superadminAuthHeader)
      .send({ decision: "APPROVE" });

    assert.equal(res.status, 403);
    assert.equal(res.body.message, "You are not allowed to approve this step");
  });

  test("POST /api/admin/attendance/approvals/:id/decision allows superadmin on platform step", async () => {
    prismaMock.approvalRequest.findFirst = async () => ({
      id: 57,
      organizationId: 20,
      currentStep: 2,
      status: "PENDING",
      steps: [
        {
          id: 510,
          stepOrder: 1,
          scope: "ORG",
          status: "APPROVED",
          approverId: 2,
          platformApproverId: null,
        },
        {
          id: 511,
          stepOrder: 2,
          scope: "PLATFORM",
          status: "PENDING",
          approverId: null,
          platformApproverId: 99,
        },
      ],
    });
    prismaMock.$transaction = async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        approvalStep: {
          update: async () => ({}),
        },
        approvalRequest: {
          update: async () => ({}),
          findUnique: async () => ({
            id: 57,
            status: "APPROVED",
            currentStep: 2,
            steps: [],
          }),
        },
      };
      return callback(tx);
    };

    const res = await request(app)
      .post("/api/admin/attendance/approvals/57/decision")
      .set(superadminAuthHeader)
      .send({ decision: "APPROVE" });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "APPROVED");
  });

  test("POST /api/attendance/approvals rejects legacy LEAVE type", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .set(mobileAuthHeader)
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

  test("GET /api/admin/plan allows superadmin scope", async () => {
    prismaMock.plan.findMany = async () => [];
    const res = await request(app)
      .get("/api/admin/plan")
      .set(superadminAuthHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Fetched Successfully");
  });

  test("GET /api/admin/organization allows superadmin scope", async () => {
    prismaMock.organization.count = async () => 1;
    prismaMock.organization.findMany = async () => [
      {
        id: 10,
        name: "Org One",
        total_employees: 3,
        status: "ACTIVE",
        expire_time: null,
        code: "ORG-001",
        plan: {
          id: 1,
          name: "Starter",
        },
      },
    ];

    const res = await request(app)
      .get("/api/admin/organization")
      .set(superadminAuthHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Organization Fetched");
    assert.equal(Array.isArray(res.body.data), true);
    assert.equal(res.body.data.length, 1);
  });

  test("GET /api/admin/departments allows superadmin scope", async () => {
    prismaMock.department.count = async () => 1;
    prismaMock.department.findMany = async () => [
      {
        id: 1,
        name: "Operations",
        location: "HQ",
        positions: [],
      },
    ];

    const res = await request(app)
      .get("/api/admin/departments")
      .set(superadminAuthHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Departments fetched");
    assert.equal(Array.isArray(res.body.data), true);
    assert.equal(res.body.data.length, 1);
  });

  test("GET /api/admin/positions allows superadmin scope", async () => {
    prismaMock.position.count = async () => 1;
    prismaMock.position.findMany = async () => [
      {
        id: 1,
        name: "HR Manager",
        department: {
          id: 1,
          name: "Operations",
        },
      },
    ];

    const res = await request(app)
      .get("/api/admin/positions")
      .set(superadminAuthHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Positions fetched");
    assert.equal(Array.isArray(res.body.data), true);
    assert.equal(res.body.data.length, 1);
  });

  test("POST /api/admin/organization allows superadmin scope", async () => {
    prismaMock.codeCounter.upsert = async () => ({ value: 9 });
    prismaMock.employee.findFirst = async () => null;
    prismaMock.organization.create = async () => ({
      id: 11,
      name: "New Org",
      ownerEmail: "owner@neworg.local",
      total_employees: 100,
      status: "APPROVED",
      expire_time: null,
      code: "ORG-009",
      planId: 1,
    });
    prismaMock.department.create = async () => ({ id: 20 });
    prismaMock.employee.create = async () => ({
      id: 100,
      email: "owner@neworg.local",
      full_name: "New Org Super Admin",
      code: "EMP-009",
    });
    prismaMock.designation.upsert = async () => ({ id: 31 });
    prismaMock.menu.findMany = async () => [{ id: 1 }, { id: 2 }];
    prismaMock.designationOnMenu.upsert = async () => ({});
    prismaMock.designationOnEmployee.upsert = async () => ({});

    const res = await request(app)
      .post("/api/admin/organization")
      .set(superadminAuthHeader)
      .send({
        name: "New Org",
        ownerEmail: "owner@neworg.local",
        ownerPassword: "123456",
        total_employees: 100,
        status: "APPROVED",
        planId: 1,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Organization Created");
    assert.equal(res.body.data.name, "New Org");
  });
});
