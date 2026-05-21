import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  Action,
  AttendanceRecordState,
  AttendanceWorkStatus,
  ContractStatus,
  EmployeeStatus,
  EmployeeType,
  LeaveRequestStatus,
  MenuCode,
  OrganizationStatus,
  WeekDay,
} from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run seed");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const timeUtc = (hh: number, mm: number) =>
  new Date(Date.UTC(1970, 0, 1, hh, mm, 0, 0));
const dateUtc = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00.000Z`);
const todayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const ALL_ACTIONS = [Action.CREATE, Action.VIEW, Action.UPDATE, Action.DELETE];

async function main() {
  const menuMap = new Map<MenuCode, { id: number; menu: MenuCode }>();
  const existingMenus = await prisma.menu.findMany({
    select: { id: true, menu: true },
  });
  existingMenus.forEach((item) => menuMap.set(item.menu, item));

  for (const menu of Object.values(MenuCode)) {
    if (!menuMap.has(menu)) {
      const created = await prisma.menu.create({ data: { menu } });
      menuMap.set(menu, { id: created.id, menu: created.menu });
    }
  }

  let plan = await prisma.plan.findFirst({
    where: { code: "SEED_BASIC" },
  });
  if (!plan) {
    plan = await prisma.plan.create({
      data: { code: "SEED_BASIC", name: "Seed Basic Plan" },
    });
  }

  for (const menu of menuMap.values()) {
    await prisma.planOnMenu.upsert({
      where: {
        planId_menuId: {
          planId: plan.id,
          menuId: menu.id,
        },
      },
      update: { actions: ALL_ACTIONS },
      create: {
        planId: plan.id,
        menuId: menu.id,
        actions: ALL_ACTIONS,
      },
    });
  }

  const org = await prisma.organization.upsert({
    where: { code: "SEED-ORG" },
    update: {
      name: "Seed Organization",
      total_employees: 100,
      status: OrganizationStatus.APPROVED,
      planId: plan.id,
      working_days: [WeekDay.MON, WeekDay.TUE, WeekDay.WED, WeekDay.THU, WeekDay.FRI],
      off_days: [WeekDay.SAT, WeekDay.SUN],
    },
    create: {
      name: "Seed Organization",
      code: "SEED-ORG",
      total_employees: 100,
      status: OrganizationStatus.APPROVED,
      planId: plan.id,
      working_days: [WeekDay.MON, WeekDay.TUE, WeekDay.WED, WeekDay.THU, WeekDay.FRI],
      off_days: [WeekDay.SAT, WeekDay.SUN],
    },
  });

  const department = await prisma.department.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: "Engineering",
      },
    },
    update: {
      is_active: true,
      employee_count: 3,
      location: "Yangon",
      annual_budget: "10000000",
      startTime: timeUtc(9, 0),
      endTime: timeUtc(17, 30),
      working_days: [WeekDay.MON, WeekDay.TUE, WeekDay.WED, WeekDay.THU, WeekDay.FRI],
    },
    create: {
      organizationId: org.id,
      name: "Engineering",
      is_active: true,
      employee_count: 3,
      location: "Yangon",
      annual_budget: "10000000",
      startTime: timeUtc(9, 0),
      endTime: timeUtc(17, 30),
      working_days: [WeekDay.MON, WeekDay.TUE, WeekDay.WED, WeekDay.THU, WeekDay.FRI],
    },
  });

  const position = await prisma.position.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: "Software Engineer",
      },
    },
    update: {
      is_active: true,
      department_id: department.id,
      avg_salary: 900000,
      min_salary: 700000,
      max_salary: 1400000,
    },
    create: {
      organizationId: org.id,
      department_id: department.id,
      name: "Software Engineer",
      is_active: true,
      avg_salary: 900000,
      min_salary: 700000,
      max_salary: 1400000,
    },
  });

  const adminDesignation = await prisma.designation.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: "HR Admin",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: "HR Admin",
    },
  });

  for (const menu of menuMap.values()) {
    await prisma.designationOnMenu.upsert({
      where: {
        designationId_menuId: {
          designationId: adminDesignation.id,
          menuId: menu.id,
        },
      },
      update: { actions: ALL_ACTIONS },
      create: {
        designationId: adminDesignation.id,
        menuId: menu.id,
        actions: ALL_ACTIONS,
      },
    });
  }

  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.employee.upsert({
    where: { code: "SEED-EMP-ADMIN" },
    update: {
      full_name: "Seed Admin",
      email: "seed.admin@hr.local",
      password: passwordHash,
      location: "Yangon",
      department_id: department.id,
      organizationId: org.id,
      status: EmployeeStatus.ACTIVE,
      employment_type: EmployeeType.FULL_TIME,
    },
    create: {
      full_name: "Seed Admin",
      code: "SEED-EMP-ADMIN",
      email: "seed.admin@hr.local",
      password: passwordHash,
      location: "Yangon",
      department_id: department.id,
      organizationId: org.id,
      status: EmployeeStatus.ACTIVE,
      employment_type: EmployeeType.FULL_TIME,
    },
  });

  const manager = await prisma.employee.upsert({
    where: { code: "SEED-EMP-MGR" },
    update: {
      full_name: "Seed Manager",
      email: "seed.manager@hr.local",
      password: passwordHash,
      location: "Yangon",
      department_id: department.id,
      organizationId: org.id,
      status: EmployeeStatus.ACTIVE,
      employment_type: EmployeeType.FULL_TIME,
    },
    create: {
      full_name: "Seed Manager",
      code: "SEED-EMP-MGR",
      email: "seed.manager@hr.local",
      password: passwordHash,
      location: "Yangon",
      department_id: department.id,
      organizationId: org.id,
      status: EmployeeStatus.ACTIVE,
      employment_type: EmployeeType.FULL_TIME,
    },
  });

  const staff = await prisma.employee.upsert({
    where: { code: "SEED-EMP-001" },
    update: {
      full_name: "Seed Staff",
      email: "seed.staff@hr.local",
      password: passwordHash,
      location: "Yangon",
      department_id: department.id,
      organizationId: org.id,
      status: EmployeeStatus.ACTIVE,
      employment_type: EmployeeType.FULL_TIME,
      contracts: ["https://seed.local/contracts/staff-contract-v1.pdf"],
    },
    create: {
      full_name: "Seed Staff",
      code: "SEED-EMP-001",
      email: "seed.staff@hr.local",
      password: passwordHash,
      location: "Yangon",
      department_id: department.id,
      organizationId: org.id,
      status: EmployeeStatus.ACTIVE,
      employment_type: EmployeeType.FULL_TIME,
      contracts: ["https://seed.local/contracts/staff-contract-v1.pdf"],
    },
  });

  for (const employee of [admin, manager, staff]) {
    await prisma.designationOnEmployee.upsert({
      where: {
        designationId_employeeId: {
          designationId: adminDesignation.id,
          employeeId: employee.id,
        },
      },
      update: {},
      create: {
        designationId: adminDesignation.id,
        employeeId: employee.id,
      },
    });
  }

  for (const employee of [admin, manager, staff]) {
    await prisma.employeeOnPosition.upsert({
      where: {
        employee_id_position_id: {
          employee_id: employee.id,
          position_id: position.id,
        },
      },
      update: {},
      create: {
        employee_id: employee.id,
        position_id: position.id,
      },
    });
  }

  await prisma.attendancePolicy.upsert({
    where: { organizationId: org.id },
    update: {
      defaultStartTime: timeUtc(9, 0),
      defaultEndTime: timeUtc(17, 30),
      lateGraceMinutes: 10,
      earlyLeaveGraceMinutes: 10,
      minHalfDayMinutes: 240,
    },
    create: {
      organizationId: org.id,
      defaultStartTime: timeUtc(9, 0),
      defaultEndTime: timeUtc(17, 30),
      lateGraceMinutes: 10,
      earlyLeaveGraceMinutes: 10,
      minHalfDayMinutes: 240,
    },
  });

  const officeShift = await prisma.attendanceShift.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: "Office Shift",
      },
    },
    update: {
      weekdays: [WeekDay.MON, WeekDay.TUE, WeekDay.WED, WeekDay.THU, WeekDay.FRI],
      startTime: timeUtc(9, 0),
      endTime: timeUtc(17, 30),
      lateGraceMinutes: 10,
      earlyLeaveGraceMinutes: 10,
      isActive: true,
      isDefault: true,
    },
    create: {
      organizationId: org.id,
      name: "Office Shift",
      weekdays: [WeekDay.MON, WeekDay.TUE, WeekDay.WED, WeekDay.THU, WeekDay.FRI],
      startTime: timeUtc(9, 0),
      endTime: timeUtc(17, 30),
      lateGraceMinutes: 10,
      earlyLeaveGraceMinutes: 10,
      isActive: true,
      isDefault: true,
    },
  });

  const today = todayUtc();
  const existingAttendance = await prisma.attendanceRecord.findFirst({
    where: {
      organizationId: org.id,
      employeeId: staff.id,
      workDate: today,
    },
  });

  if (!existingAttendance) {
    await prisma.attendanceRecord.create({
      data: {
        organizationId: org.id,
        employeeId: staff.id,
        shiftId: officeShift.id,
        workDate: today,
        checkInAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        checkOutAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        lateMinutes: 5,
        earlyLeaveMinutes: 0,
        workedMinutes: 300,
        status: AttendanceWorkStatus.PRESENT,
        recordState: AttendanceRecordState.CLOSED,
        notes: "Seed attendance record",
      },
    });
  }

  const annualLeave = await prisma.leaveType.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: "ANNUAL",
      },
    },
    update: {
      name: "Annual Leave",
      annualQuotaDays: 14,
      carryForwardLimit: 5,
      requiresApproval: true,
      isActive: true,
    },
    create: {
      organizationId: org.id,
      code: "ANNUAL",
      name: "Annual Leave",
      annualQuotaDays: 14,
      carryForwardLimit: 5,
      requiresApproval: true,
      isActive: true,
    },
  });

  await prisma.leaveType.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: "SICK",
      },
    },
    update: {
      name: "Sick Leave",
      annualQuotaDays: 10,
      carryForwardLimit: 0,
      requiresApproval: true,
      isActive: true,
    },
    create: {
      organizationId: org.id,
      code: "SICK",
      name: "Sick Leave",
      annualQuotaDays: 10,
      carryForwardLimit: 0,
      requiresApproval: true,
      isActive: true,
    },
  });

  const currentYear = new Date().getUTCFullYear();
  await prisma.leaveBalance.upsert({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: staff.id,
        leaveTypeId: annualLeave.id,
        year: currentYear,
      },
    },
    update: {
      entitledDays: 14,
      carriedDays: 2,
      usedDays: 4,
      remainingDays: 12,
    },
    create: {
      organizationId: org.id,
      employeeId: staff.id,
      leaveTypeId: annualLeave.id,
      year: currentYear,
      entitledDays: 14,
      carriedDays: 2,
      usedDays: 4,
      remainingDays: 12,
    },
  });

  for (const holiday of [
    { date: dateUtc(`${currentYear}-01-01`), name: "New Year Day" },
    { date: dateUtc(`${currentYear}-12-25`), name: "Christmas Day" },
  ]) {
    await prisma.holidayCalendar.upsert({
      where: {
        organizationId_date_name: {
          organizationId: org.id,
          date: holiday.date,
          name: holiday.name,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        date: holiday.date,
        name: holiday.name,
        isOptional: false,
      },
    });
  }

  const seedLeaveStart = dateUtc(`${currentYear}-11-10`);
  const seedLeaveEnd = dateUtc(`${currentYear}-11-12`);
  const existingRequest = await prisma.leaveRequest.findFirst({
    where: {
      organizationId: org.id,
      employeeId: staff.id,
      leaveTypeId: annualLeave.id,
      startDate: seedLeaveStart,
      endDate: seedLeaveEnd,
    },
  });

  if (!existingRequest) {
    await prisma.leaveRequest.create({
      data: {
        organizationId: org.id,
        employeeId: staff.id,
        leaveTypeId: annualLeave.id,
        startDate: seedLeaveStart,
        endDate: seedLeaveEnd,
        totalDays: 3,
        reason: "Seed annual leave request",
        status: LeaveRequestStatus.PENDING,
      },
    });
  }

  await prisma.employeeContract.upsert({
    where: {
      employeeId_version: {
        employeeId: staff.id,
        version: 1,
      },
    },
    update: {
      fileUrl: "https://seed.local/contracts/staff-contract-v1.pdf",
      status: ContractStatus.ACTIVE,
      reminderDays: 30,
    },
    create: {
      employeeId: staff.id,
      version: 1,
      fileUrl: "https://seed.local/contracts/staff-contract-v1.pdf",
      status: ContractStatus.ACTIVE,
      reminderDays: 30,
    },
  });

  console.info("Seed completed.");
  console.info("Seed login credentials:");
  console.info("  email: seed.admin@hr.local");
  console.info("  password: password123");
  console.info("  organizationCode: SEED-ORG");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
