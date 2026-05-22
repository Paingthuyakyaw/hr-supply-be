import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../index";
import { prisma } from "../../lib/prisma";
import {
  Action,
  EmployeeStatus,
  MenuCode,
  PlatformPermission,
} from "../generated/prisma/enums";
import { signRefreshToken } from "../utils/token";

const prismaMock = prisma as any;

const password = "password123";

const buildEmployeeProfile = () => ({
  id: 1,
  email: "admin@test.com",
  code: "EMP-001",
  phoneNumber: "09123456789",
  organizationId: 10,
  status: EmployeeStatus.ACTIVE,
  organization: {
    plan: {
      menuPermission: [],
    },
  },
  department: null,
  positions: [],
  designations: [
    {
      designation: {
        id: 1,
        name: "HR Admin",
        menuPermission: [
          {
            menu: { menu: MenuCode.DASHBOARD },
            actions: [Action.VIEW],
          },
          {
            menu: { menu: MenuCode.EMPLOYEE },
            actions: [Action.VIEW, Action.UPDATE],
          },
        ],
      },
    },
  ],
});

beforeEach(async () => {
  const hashed = await bcrypt.hash(password, 10);
  prismaMock.platformUser = {
    findUnique: async () => null,
  };
  prismaMock.employee.findFirst = async () => ({
    id: 1,
    password: hashed,
  });
  prismaMock.employee.findUnique = async () => buildEmployeeProfile();
});

describe("auth integration", () => {
  test("POST /api/auth/admin/login returns admin-scoped tokens", async () => {
    const res = await request(app).post("/api/auth/admin/login").send({
      email: "admin@test.com",
      password,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Admin login successful");
    assert.ok(res.body.tokens.accessToken);
    assert.ok(res.body.tokens.refreshToken);
    assert.equal(Array.isArray(res.body.data.permissions), true);
    assert.equal(res.body.data.permissions.length > 0, true);
  });

  test("POST /api/auth/mobile/login accepts code as identifier", async () => {
    const res = await request(app).post("/api/auth/mobile/login").send({
      identifier: "EMP-001",
      password,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Mobile login successful");
    assert.ok(res.body.tokens.accessToken);
    assert.deepEqual(res.body.data.permissions, []);
  });

  test("POST /api/auth/admin/refresh rejects mobile refresh token", async () => {
    const token = signRefreshToken({
      sub: 1,
      orgId: 10,
      email: "mobile@test.com",
      clientType: "mobile",
    });

    const res = await request(app).post("/api/auth/admin/refresh").send({
      refreshToken: token,
    });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /not valid for admin auth flow/i);
  });

  test("POST /api/auth/admin/login returns SUPERADMIN scope for platform account", async () => {
    const hashed = await bcrypt.hash(password, 10);
    prismaMock.platformUser.findUnique = async (args: any) => {
      if (args?.where?.email) {
        return { id: 99, password: hashed };
      }
      if (args?.where?.id === 99) {
        return {
          id: 99,
          email: "super@platform.local",
          fullName: "Platform Superadmin",
          isActive: true,
          permissions: [PlatformPermission.APPROVAL_VIEW, PlatformPermission.APPROVAL_DECIDE],
        };
      }
      return null;
    };
    prismaMock.employee.findFirst = async () => null;

    const res = await request(app).post("/api/auth/admin/login").send({
      email: "super@platform.local",
      password,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.scope, "SUPERADMIN");
    assert.deepEqual(res.body.data.permissions, [
      PlatformPermission.APPROVAL_VIEW,
      PlatformPermission.APPROVAL_DECIDE,
    ]);
  });

  test("POST /api/auth/admin/refresh accepts superadmin-scoped token", async () => {
    prismaMock.platformUser.findUnique = async (args: any) => {
      if (args?.where?.id === 99) {
        return {
          id: 99,
          email: "super@platform.local",
          fullName: "Platform Superadmin",
          isActive: true,
          permissions: [PlatformPermission.APPROVAL_VIEW, PlatformPermission.APPROVAL_DECIDE],
        };
      }
      return null;
    };
    const token = signRefreshToken({
      sub: 99,
      orgId: 0,
      email: "super@platform.local",
      clientType: "admin",
      adminScope: "SUPERADMIN",
      actorType: "platform",
    });

    const res = await request(app).post("/api/auth/admin/refresh").send({
      refreshToken: token,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.scope, "SUPERADMIN");
  });
});
