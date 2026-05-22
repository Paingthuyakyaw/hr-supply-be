import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import request from "supertest";
import app from "../index";
import { prisma } from "../../lib/prisma";
import { signAccessToken } from "../utils/token";
import { PlatformPermission } from "../generated/prisma/enums";

const prismaMock = prisma as any;

const superadminAccessToken = signAccessToken({
  sub: 99,
  orgId: 0,
  email: "superadmin@gmail.com",
  clientType: "admin",
  adminScope: "SUPERADMIN",
  actorType: "platform",
});
const ownAdminAccessToken = signAccessToken({
  sub: 1,
  orgId: 10,
  email: "admin@test.com",
  clientType: "admin",
  adminScope: "OWN_ADMIN",
  actorType: "employee",
});

const superadminAuthHeader = { Authorization: `Bearer ${superadminAccessToken}` };
const ownAdminAuthHeader = { Authorization: `Bearer ${ownAdminAccessToken}` };

beforeEach(() => {
  prismaMock.platformUser.findUnique = async (args: any) => {
    if (args?.where?.id === 99) {
      return {
        isActive: true,
        permissions: [PlatformPermission.APPROVAL_VIEW, PlatformPermission.APPROVAL_DECIDE],
      };
    }
    return null;
  };
  prismaMock.platformUser.findMany = async () => [];
  prismaMock.platformUser.count = async () => 0;
  prismaMock.platformUser.create = async (args: any) => ({
    id: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...args.data,
  });
  prismaMock.platformUser.update = async (args: any) => ({
    id: args.where.id,
    email: "pm@platform.local",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...args.data,
  });
  prismaMock.platformUser.delete = async () => ({});
});

describe("platform user integration", () => {
  test("GET /api/admin/platform-users is superadmin-only", async () => {
    const forbidden = await request(app).get("/api/admin/platform-users").set(ownAdminAuthHeader);
    assert.equal(forbidden.status, 401);

    const ok = await request(app).get("/api/admin/platform-users").set(superadminAuthHeader);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.message, "Platform users fetched");
  });

  test("POST /api/admin/platform-users creates platform user", async () => {
    prismaMock.platformUser.findUnique = async (args: any) => {
      if (args?.where?.id === 99) {
        return {
          isActive: true,
          permissions: [PlatformPermission.APPROVAL_VIEW, PlatformPermission.APPROVAL_DECIDE],
        };
      }
      if (args?.where?.email === "pm@platform.local") return null;
      return null;
    };

    const res = await request(app)
      .post("/api/admin/platform-users")
      .set(superadminAuthHeader)
      .send({
        email: "pm@platform.local",
        fullName: "Platform Manager",
        password: "123456",
        permissions: [PlatformPermission.APPROVAL_VIEW],
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.email, "pm@platform.local");
  });

  test("PATCH /api/admin/platform-users/:id updates platform user", async () => {
    prismaMock.platformUser.findUnique = async (args: any) => {
      if (args?.where?.id === 99) {
        return {
          isActive: true,
          permissions: [PlatformPermission.APPROVAL_VIEW, PlatformPermission.APPROVAL_DECIDE],
        };
      }
      if (args?.where?.id === 5) {
        return {
          id: 5,
          isActive: true,
          permissions: [PlatformPermission.APPROVAL_VIEW],
        };
      }
      return null;
    };

    const res = await request(app)
      .patch("/api/admin/platform-users/5")
      .set(superadminAuthHeader)
      .send({
        isActive: false,
        permissions: [PlatformPermission.APPROVAL_DECIDE],
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Platform user updated");
    assert.equal(res.body.data.isActive, false);
  });
});
