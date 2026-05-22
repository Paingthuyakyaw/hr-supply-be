import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  Action,
  ApprovalStatus,
  ApprovalStepScope,
  ApprovalStepStatus,
  ApprovalType,
  AttendanceRecordState,
  AttendanceWorkStatus,
  ContractStatus,
  EmployeeStatus,
  EmployeeType,
  LeaveRequestStatus,
  MenuCode,
  OrganizationStatus,
  PayrollCalculationType,
  PayrollComponentType,
  PayrollEmployeeStatus,
  PayrollRunStatus,
  PlatformPermission,
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
const SEED_OWNER_EMAIL = "seed.owner@hr.local";
const SEED_OWNER_PASSWORD = "123456";
const SEED_ADMIN_EMAIL = "seed.admin@hr.local";
const SEED_ADMIN_PASSWORD = "password123";
const SEED_MANAGER_EMAIL = "seed.manager@hr.local";
const SEED_STAFF_EMAIL = "seed.staff@hr.local";

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
      ownerEmail: SEED_OWNER_EMAIL,
      total_employees: 100,
      status: OrganizationStatus.APPROVED,
      planId: plan.id,
      working_days: [WeekDay.MON, WeekDay.TUE, WeekDay.WED, WeekDay.THU, WeekDay.FRI],
      off_days: [WeekDay.SAT, WeekDay.SUN],
    },
    create: {
      name: "Seed Organization",
      code: "SEED-ORG",
      ownerEmail: SEED_OWNER_EMAIL,
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
      employee_count: 4,
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
      employee_count: 4,
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
        name: "Org Super Admin",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: "Org Super Admin",
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

  const ownerPasswordHash = await bcrypt.hash(SEED_OWNER_PASSWORD, 10);
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);

  const owner = await prisma.employee.upsert({
    where: { code: "SEED-EMP-OWNER" },
    update: {
      full_name: "Seed Owner",
      email: SEED_OWNER_EMAIL,
      password: ownerPasswordHash,
      location: "Yangon",
      department_id: department.id,
      organizationId: org.id,
      status: EmployeeStatus.ACTIVE,
      employment_type: EmployeeType.FULL_TIME,
    },
    create: {
      full_name: "Seed Owner",
      code: "SEED-EMP-OWNER",
      email: SEED_OWNER_EMAIL,
      password: ownerPasswordHash,
      location: "Yangon",
      department_id: department.id,
      organizationId: org.id,
      status: EmployeeStatus.ACTIVE,
      employment_type: EmployeeType.FULL_TIME,
    },
  });

  const admin = await prisma.employee.upsert({
    where: { code: "SEED-EMP-ADMIN" },
    update: {
      full_name: "Seed Admin",
      email: SEED_ADMIN_EMAIL,
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
      email: SEED_ADMIN_EMAIL,
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
      email: SEED_MANAGER_EMAIL,
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
      email: SEED_MANAGER_EMAIL,
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
      email: SEED_STAFF_EMAIL,
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
      email: SEED_STAFF_EMAIL,
      password: passwordHash,
      location: "Yangon",
      department_id: department.id,
      organizationId: org.id,
      status: EmployeeStatus.ACTIVE,
      employment_type: EmployeeType.FULL_TIME,
      contracts: ["https://seed.local/contracts/staff-contract-v1.pdf"],
    },
  });

  for (const employee of [owner, admin]) {
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

  for (const employee of [owner, admin, manager, staff]) {
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

  const defaultPayrollComponents = [
    {
      code: "BASIC",
      name: "Basic Salary",
      type: PayrollComponentType.EARNING,
      calculationType: PayrollCalculationType.FIXED,
      value: 900000,
      isTaxable: true,
      isActive: true,
    },
    {
      code: "TRANSPORT",
      name: "Transport Allowance",
      type: PayrollComponentType.EARNING,
      calculationType: PayrollCalculationType.FIXED,
      value: 60000,
      isTaxable: false,
      isActive: true,
    },
    {
      code: "MEAL",
      name: "Meal Allowance",
      type: PayrollComponentType.EARNING,
      calculationType: PayrollCalculationType.FIXED,
      value: 40000,
      isTaxable: false,
      isActive: true,
    },
    {
      code: "PERFORMANCE",
      name: "Performance Bonus",
      type: PayrollComponentType.EARNING,
      calculationType: PayrollCalculationType.FIXED,
      value: 50000,
      isTaxable: true,
      isActive: true,
    },
    {
      code: "INCOME_TAX",
      name: "Income Tax",
      type: PayrollComponentType.DEDUCTION,
      calculationType: PayrollCalculationType.PERCENTAGE,
      value: 5,
      isTaxable: false,
      isActive: true,
    },
    {
      code: "HEALTH_INS",
      name: "Health Insurance",
      type: PayrollComponentType.DEDUCTION,
      calculationType: PayrollCalculationType.FIXED,
      value: 30000,
      isTaxable: false,
      isActive: true,
    },
    {
      code: "PENSION",
      name: "Pension Fund",
      type: PayrollComponentType.DEDUCTION,
      calculationType: PayrollCalculationType.PERCENTAGE,
      value: 2,
      isTaxable: false,
      isActive: true,
    },
  ] as const;

  const seededPayrollComponents = [];
  for (const component of defaultPayrollComponents) {
    const upserted = await prisma.payrollComponent.upsert({
      where: {
        organizationId_code: {
          organizationId: org.id,
          code: component.code,
        },
      },
      update: {
        name: component.name,
        type: component.type,
        calculationType: component.calculationType,
        value: component.value,
        isTaxable: component.isTaxable,
        isActive: component.isActive,
      },
      create: {
        organizationId: org.id,
        code: component.code,
        name: component.name,
        type: component.type,
        calculationType: component.calculationType,
        value: component.value,
        isTaxable: component.isTaxable,
        isActive: component.isActive,
      },
    });
    seededPayrollComponents.push(upserted);
  }

  const payrollMonth = new Date().toISOString().slice(0, 7);
  const payrollRun = await prisma.payrollRun.upsert({
    where: {
      organizationId_month: {
        organizationId: org.id,
        month: payrollMonth,
      },
    },
    update: {
      status: PayrollRunStatus.DRAFT,
      notes: "Seed payroll run",
      createdById: owner.id,
      processedAt: new Date(),
    },
    create: {
      organizationId: org.id,
      month: payrollMonth,
      status: PayrollRunStatus.DRAFT,
      notes: "Seed payroll run",
      createdById: owner.id,
      processedAt: new Date(),
    },
  });

  await prisma.payrollItem.deleteMany({
    where: { organizationId: org.id, payrollRunId: payrollRun.id },
  });
  await prisma.payrollEmployeeSummary.deleteMany({
    where: { organizationId: org.id, payrollRunId: payrollRun.id },
  });

  const seedEmployees = [owner, admin, manager, staff];
  for (const employee of seedEmployees) {
    const amounts = seededPayrollComponents.map((component) => {
      if (
        component.type === PayrollComponentType.EARNING &&
        component.calculationType === PayrollCalculationType.FIXED
      ) {
        return { componentId: component.id, type: component.type, amount: Number(component.value) };
      }
      if (
        component.type === PayrollComponentType.EARNING &&
        component.calculationType === PayrollCalculationType.PERCENTAGE
      ) {
        return {
          componentId: component.id,
          type: component.type,
          amount: (900000 * Number(component.value)) / 100,
        };
      }
      if (
        component.type === PayrollComponentType.DEDUCTION &&
        component.calculationType === PayrollCalculationType.FIXED
      ) {
        return { componentId: component.id, type: component.type, amount: Number(component.value) * -1 };
      }
      return {
        componentId: component.id,
        type: component.type,
        amount: ((900000 * Number(component.value)) / 100) * -1,
      };
    });

    const totalAllowances = amounts
      .filter((item) => item.type === PayrollComponentType.EARNING)
      .reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions = amounts
      .filter((item) => item.type === PayrollComponentType.DEDUCTION)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const netPay = totalAllowances - totalDeductions;

    const summary = await prisma.payrollEmployeeSummary.create({
      data: {
        organizationId: org.id,
        payrollRunId: payrollRun.id,
        employeeId: employee.id,
        basicSalary: 900000,
        totalAllowances,
        totalDeductions,
        netPay,
        status:
          employee.id === admin.id
            ? PayrollEmployeeStatus.PAID
            : PayrollEmployeeStatus.PROCESSED,
        paidAt: employee.id === admin.id ? new Date() : null,
        notes: "Seed payroll summary",
      },
    });

    if (amounts.length) {
      await prisma.payrollItem.createMany({
        data: amounts.map((item) => ({
          organizationId: org.id,
          payrollRunId: payrollRun.id,
          employeeId: employee.id,
          componentId: item.componentId,
          amount: item.amount,
          employeeSummaryId: summary.id,
        })),
      });
    }
  }

  const superadminPasswordHash = await bcrypt.hash("123456", 10);
  const superadmin = await prisma.platformUser.upsert({
    where: { email: "superadmin@gmail.com" },
    update: {
      fullName: "Super Admin User",
      password: superadminPasswordHash,
      isActive: true,
      permissions: [PlatformPermission.APPROVAL_VIEW, PlatformPermission.APPROVAL_DECIDE],
    },
    create: {
      email: "superadmin@gmail.com",
      fullName: "Super Admin User",
      password: superadminPasswordHash,
      isActive: true,
      permissions: [PlatformPermission.APPROVAL_VIEW, PlatformPermission.APPROVAL_DECIDE],
    },
  });

  const existingEscalatedApproval = await prisma.approvalRequest.findFirst({
    where: {
      organizationId: org.id,
      requesterId: staff.id,
      type: ApprovalType.OVERTIME,
      status: ApprovalStatus.PENDING,
      currentStep: 2,
    },
    select: { id: true },
  });
  if (!existingEscalatedApproval) {
    const escalatedRequest = await prisma.approvalRequest.create({
      data: {
        organizationId: org.id,
        requesterId: staff.id,
        targetEmployeeId: staff.id,
        type: ApprovalType.OVERTIME,
        status: ApprovalStatus.PENDING,
        currentStep: 2,
        payload: {
          workDate: `${currentYear}-11-20`,
          startTime: "18:00",
          endTime: "20:00",
          totalHours: 2,
          reason: "Seed escalated overtime request",
        },
      },
    });

    await prisma.approvalStep.createMany({
      data: [
        {
          requestId: escalatedRequest.id,
          stepOrder: 1,
          scope: ApprovalStepScope.ORG,
          approverId: manager.id,
          status: ApprovalStepStatus.APPROVED,
          comment: "Approved by manager",
          actedAt: new Date(),
        },
        {
          requestId: escalatedRequest.id,
          stepOrder: 2,
          scope: ApprovalStepScope.PLATFORM,
          platformApproverId: superadmin.id,
          status: ApprovalStepStatus.PENDING,
        },
      ],
    });
  }

  console.info("Seed completed.");
  console.info("Seed org owner credentials:");
  console.info(`  email: ${SEED_OWNER_EMAIL}`);
  console.info(`  password: ${SEED_OWNER_PASSWORD}`);
  console.info("Seed org admin credentials:");
  console.info(`  email: ${SEED_ADMIN_EMAIL}`);
  console.info(`  password: ${SEED_ADMIN_PASSWORD}`);
  console.info("  organizationCode: SEED-ORG");
  console.info("Superadmin login credentials:");
  console.info("  email: superadmin@gmail.com");
  console.info("  password: 123456");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
