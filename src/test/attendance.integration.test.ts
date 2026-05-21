import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import request from "supertest";
import app from "../index";
import { prisma } from "../../lib/prisma";
import { Action, AttendanceRecordState } from "../generated/prisma/enums";
import { signAccessToken } from "../utils/token";

const prismaMock = prisma as any;

const accessToken = signAccessToken({
  sub: 1,
  orgId: 10,
  email: "attendance@test.com",
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
  prismaMock.attendanceRecord.findFirst = async () => null;
  prismaMock.attendanceRecord.create = async (args: any) => ({
    id: 1,
    ...args.data,
    shift: null,
  });
  prismaMock.attendanceRecord.update = async (args: any) => ({
    id: args.where.id,
    ...args.data,
    checkInAt: new Date(Date.now() - 2 * 60 * 60000),
    shift: null,
  });
  prismaMock.attendanceRecord.findMany = async () => [];
  prismaMock.attendanceRecord.count = async () => 0;
  prismaMock.attendancePolicy.findUnique = async () => ({
    id: 5,
    organizationId: 10,
    defaultStartTime: new Date("1970-01-01T09:00:00.000Z"),
    defaultEndTime: new Date("1970-01-01T17:30:00.000Z"),
    lateGraceMinutes: 10,
    earlyLeaveGraceMinutes: 10,
    minHalfDayMinutes: 240,
  });
  prismaMock.attendancePolicy.upsert = async (args: any) => ({
    id: 5,
    organizationId: 10,
    ...args.update,
  });
  prismaMock.attendanceShift.findFirst = async () => null;
  prismaMock.attendanceShift.findMany = async () => [];
  prismaMock.$transaction = async (callback: (tx: any) => Promise<any>) => {
    const tx = {
      attendanceShift: {
        updateMany: async () => ({ count: 0 }),
        create: async (args: any) => ({ id: 12, ...args.data }),
        update: async (args: any) => ({ id: args.where.id, ...args.data }),
      },
    };
    return callback(tx);
  };
});

describe("attendance integration", () => {
  test("POST /api/attendance/check-in creates attendance record", async () => {
    prismaMock.attendancePolicy.findUnique = async () => ({
      id: 5,
      organizationId: 10,
      defaultStartTime: new Date("1970-01-01T00:00:00.000Z"),
      defaultEndTime: new Date("1970-01-01T17:30:00.000Z"),
      lateGraceMinutes: 0,
      earlyLeaveGraceMinutes: 10,
      minHalfDayMinutes: 240,
    });

    const res = await request(app)
      .post("/api/attendance/check-in")
      .set(authHeader)
      .send({ notes: "start work" });

    assert.equal(res.status, 201);
    assert.equal(res.body.message, "Checked in successfully");
    assert.equal(res.body.data.recordState, AttendanceRecordState.OPEN);
    assert.ok(Number(res.body.data.lateMinutes) >= 0);
  });

  test("POST /api/attendance/check-out applies early/half-day rules", async () => {
    prismaMock.attendanceRecord.findFirst = async () => ({
      id: 22,
      organizationId: 10,
      employeeId: 1,
      checkInAt: new Date(Date.now() - 2 * 60 * 60000),
      notes: null,
      shift: {
        id: 1,
        name: "Night Shift",
        endTime: new Date("1970-01-01T23:59:00.000Z"),
        earlyLeaveGraceMinutes: 0,
      },
    });

    prismaMock.attendanceRecord.update = async (args: any) => ({
      id: args.where.id,
      organizationId: 10,
      employeeId: 1,
      checkInAt: new Date(Date.now() - 2 * 60 * 60000),
      checkOutAt: new Date(),
      workedMinutes: args.data.workedMinutes,
      earlyLeaveMinutes: args.data.earlyLeaveMinutes,
      status: args.data.status,
      recordState: args.data.recordState,
      shift: { id: 1, name: "Night Shift", startTime: null, endTime: null },
    });

    const res = await request(app)
      .post("/api/attendance/check-out")
      .set(authHeader)
      .send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Checked out successfully");
    assert.equal(res.body.data.status, "HALF_DAY");
    assert.ok(Number(res.body.data.earlyLeaveMinutes) > 0);
  });

  test("PUT /api/admin/attendance/policy upserts policy", async () => {
    const res = await request(app)
      .put("/api/admin/attendance/policy")
      .set(authHeader)
      .send({
        defaultStartTime: "09:00",
        defaultEndTime: "17:30",
        lateGraceMinutes: 15,
        earlyLeaveGraceMinutes: 10,
        minHalfDayMinutes: 240,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Attendance policy saved");
    assert.equal(res.body.data.lateGraceMinutes, 15);
  });

  test("GET /api/admin/attendance/records returns paginated records", async () => {
    prismaMock.attendanceRecord.count = async () => 1;
    prismaMock.attendanceRecord.findMany = async () => [
      {
        id: 70,
        organizationId: 10,
        employeeId: 1,
        workDate: new Date("2026-05-21T00:00:00.000Z"),
        recordState: "CLOSED",
        status: "PRESENT",
        employee: { id: 1, full_name: "Test User", code: "EMP-001" },
        shift: { id: 2, name: "Office" },
      },
    ];

    const res = await request(app)
      .get("/api/admin/attendance/records")
      .set(authHeader)
      .query({ page: 1, size: 20 });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Attendance records fetched");
    assert.equal(res.body.meta.total, 1);
    assert.equal(res.body.data[0].employee.code, "EMP-001");
  });
});
