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
  email: "test@example.com",
  clientType: "admin",
});

const authHeader = { Authorization: `Bearer ${accessToken}` };

const allowActions = (actions: Action[]) => {
  prismaMock.employee.findUnique = async () => ({
    organization: {
      plan: {
        menuPermission: [{ actions }],
      },
    },
    designations: [],
  });
};

beforeEach(() => {
  allowActions([Action.VIEW, Action.CREATE, Action.UPDATE, Action.DELETE]);
  prismaMock.designation.findMany = async () => [];
  prismaMock.designation.count = async () => 0;
  prismaMock.designation.findFirst = async () => null;
  prismaMock.designation.create = async () => ({
    id: 1,
    name: "HR Manager",
    organizationId: 10,
    menuPermission: [],
  });
  prismaMock.menu.findMany = async () => [];
  prismaMock.employee.findMany = async () => [];
  prismaMock.$transaction = async (cb: (tx: any) => Promise<any>) =>
    cb({
      designation: {
        update: async () => ({}),
        delete: async () => ({}),
        findUnique: async () => ({
          id: 1,
          name: "Updated Name",
          organizationId: 10,
          menuPermission: [],
        }),
      },
      designationOnMenu: {
        deleteMany: async () => ({}),
        createMany: async () => ({}),
      },
      designationOnEmployee: {
        deleteMany: async () => ({}),
        createMany: async () => ({}),
      },
    });
});

describe("designation integration", () => {
  test("GET /api/designation returns standardized list response", async () => {
    prismaMock.designation.findMany = async () => [
      {
        id: 3,
        name: "Supervisor",
        organizationId: 10,
        _count: { menuPermission: 2 },
        organization: { name: "Org A" },
      },
    ];
    prismaMock.designation.count = async () => 1;

    const res = await request(app)
      .get("/api/admin/designation?page=1&size=10")
      .set(authHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.error, null);
    assert.equal(res.body.meta.totalItems, 1);
    assert.equal(res.body.data[0].name, "Supervisor");
  });

  test("GET /api/designation/:id returns 404 when missing", async () => {
    prismaMock.designation.findFirst = async () => null;

    const res = await request(app).get("/api/admin/designation/999").set(authHeader);

    assert.equal(res.status, 404);
    assert.equal(res.body.data, null);
    assert.equal(res.body.message, "Designation not found");
  });

  test("GET /api/designation/:id validates id parameter", async () => {
    const res = await request(app).get("/api/admin/designation/abc").set(authHeader);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Validation Error");
    assert.ok(res.body.error);
  });

  test("POST /api/designation denies without CREATE permission", async () => {
    allowActions([Action.VIEW]);

    const res = await request(app).post("/api/admin/designation").set(authHeader).send({
      name: "Assistant",
      permissions: [],
      employeeIds: [],
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.message, "Forbidden");
  });

  test("POST /api/designation creates designation", async () => {
    prismaMock.menu.findMany = async () => [{ id: 5, menu: "EMPLOYEE" }];
    prismaMock.employee.findMany = async () => [{ id: 11 }];
    prismaMock.designation.create = async () => ({
      id: 1,
      name: "Assistant",
      organizationId: 10,
      menuPermission: [
        {
          actions: ["VIEW", "CREATE"],
          menu: { menu: "EMPLOYEE" },
        },
      ],
    });

    const res = await request(app).post("/api/admin/designation").set(authHeader).send({
      name: "Assistant",
      permissions: [{ menu: "EMPLOYEE", actions: ["VIEW", "CREATE"] }],
      employeeIds: [11],
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.error, null);
    assert.equal(res.body.data.name, "Assistant");
    assert.equal(res.body.data.permissions[0].menu, "EMPLOYEE");
  });

  test("PUT /api/designation/:id updates designation", async () => {
    prismaMock.designation.findFirst = async () => ({ id: 1 });
    prismaMock.menu.findMany = async () => [{ id: 5, menu: "EMPLOYEE" }];
    prismaMock.employee.findMany = async () => [{ id: 12 }];
    prismaMock.$transaction = async (cb: (tx: any) => Promise<any>) =>
      cb({
        designation: {
          update: async () => ({}),
          findUnique: async () => ({
            id: 1,
            name: "Updated Name",
            organizationId: 10,
            menuPermission: [
              { actions: ["VIEW"], menu: { menu: "EMPLOYEE" } },
            ],
          }),
        },
        designationOnMenu: {
          deleteMany: async () => ({}),
          createMany: async () => ({}),
        },
        designationOnEmployee: {
          deleteMany: async () => ({}),
          createMany: async () => ({}),
        },
      });

    const res = await request(app).put("/api/admin/designation/1").set(authHeader).send({
      name: "Updated Name",
      permissions: [{ menu: "EMPLOYEE", actions: ["VIEW"] }],
      employeeIds: [12],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.error, null);
    assert.equal(res.body.data.name, "Updated Name");
  });

  test("DELETE /api/designation/:id deletes designation", async () => {
    prismaMock.designation.findFirst = async () => ({ id: 1 });
    prismaMock.$transaction = async (cb: (tx: any) => Promise<any>) =>
      cb({
        designationOnEmployee: {
          deleteMany: async () => ({}),
        },
        designationOnMenu: {
          deleteMany: async () => ({}),
        },
        designation: {
          delete: async () => ({}),
        },
      });

    const res = await request(app).delete("/api/admin/designation/1").set(authHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Designation deleted");
    assert.equal(res.body.data.id, 1);
  });
});
