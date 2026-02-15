import {
  PrismaClient,
  MenuCode,
  Action,
  PlanCode,
  EmployeeType,
  WeekDay,
  OrganizationStatus,
  EmployeeStatus,
} from "./generated/prisma/client";
import { faker } from "@faker-js/faker";
import * as bcrypt from "bcrypt"; // password hashing အတွက်
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🌱 Seeding started (Full Reset Mode with Super Admin)...");

  // ============================
  // 1️⃣ Create Menus
  // ============================
  const menuData = Object.values(MenuCode).map((code) => ({
    menu: code,
    action: [Action.VIEW, Action.CREATE, Action.UPDATE, Action.DELETE],
  }));

  await prisma.menu.createMany({ data: menuData });
  const allMenus = await prisma.menu.findMany();

  // ============================
  // 2️⃣ Create Plans (Including SUPER_ADMIN)
  // ============================
  const superPlan = await prisma.plan.create({
    data: { name: "Super Admin Plan", code: PlanCode.SUPER_ADMIN },
  });

  const freePlan = await prisma.plan.create({
    data: { name: "Free Plan", code: PlanCode.FREE },
  });

  const proPlan = await prisma.plan.create({
    data: { name: "Pro Plan", code: PlanCode.PRO },
  });

  // ============================
  // 3️⃣ Set Plan Permissions
  // ============================

  // Super Admin Plan: Full Access to ALL Menus
  for (const menu of allMenus) {
    await prisma.planOnMenu.create({
      data: {
        planId: superPlan.id,
        menuId: menu.id,
        actions: [Action.VIEW, Action.CREATE, Action.UPDATE, Action.DELETE],
      },
    });
  }

  // Free/Pro Plans: Standard permissions (as defined before)
  for (const menu of allMenus) {
    await prisma.planOnMenu.create({
      data: {
        planId: proPlan.id,
        menuId: menu.id,
        actions: [Action.VIEW, Action.CREATE, Action.UPDATE],
      },
    });
  }

  // ============================
  // 4️⃣ Create System Organization & Super Admin Employee
  // ============================

  // System Admin Org
  const systemOrg = await prisma.organization.create({
    data: {
      name: "SaaS System Management",
      total_employees: 1,
      status: OrganizationStatus.APPROVED,
      planId: superPlan.id,
    },
  });

  // Default Admin Designation for System Org
  const superDesignation = await prisma.designation.create({
    data: { name: "Super Admin", organizationId: systemOrg.id },
  });

  // Designation Permissions (Full access matching the Super Plan)
  for (const menu of allMenus) {
    await prisma.designationOnMenu.create({
      data: {
        designationId: superDesignation.id,
        menuId: menu.id,
        actions: [Action.VIEW, Action.CREATE, Action.UPDATE, Action.DELETE],
      },
    });
  }

  // IT Dept for System Org
  const systemDept = await prisma.department.create({
    data: {
      name: "System Admin Dept",
      is_active: true,
      employee_count: 1,
      location: "HQ",
      organizationId: systemOrg.id,
      startTime: new Date("1970-01-01T09:00:00Z"),
      endTime: new Date("1970-01-01T18:00:00Z"),
    },
  });

  const systemPos = await prisma.position.create({
    data: {
      name: "System Administrator",
      is_active: true,
      department_id: systemDept.id,
      organizationId: systemOrg.id,
    },
  });

  // Hashing Password
  const hashedPassword = await bcrypt.hash("Admin@123", 10);

  // Super Admin Employee
  const superUser = await prisma.employee.create({
    data: {
      full_name: "Super Admin User",
      code: "SUPER-001",
      email: "superadmin@gmail.com",
      // password field က schema မှာ မပါသေးရင် DB မှာ အရင်ထည့်ထားဖို့ လိုပါမယ်
      // အခု email/code နဲ့ login ဝင်မယ့် flow ဆိုရင် password ကို ignore လုပ်ထားလို့ရပါတယ်
      organizationId: systemOrg.id,
      department_id: systemDept.id,
      position_id: systemPos.id,
      location: "Yangon",
      status: EmployeeStatus.ACTIVE,
    },
  });

  await prisma.designationOnEmployee.create({
    data: {
      employeeId: superUser.id,
      designationId: superDesignation.id,
    },
  });

  console.log("✅ Super Admin Account: superadmin@gmail.com / Admin@123");

  // ============================
  // 5️⃣ Create Sample Business Organization (Pending Approval)
  // ============================
  const pendingOrg = await prisma.organization.create({
    data: {
      name: "Client Company Co., Ltd",
      total_employees: 0,
      status: OrganizationStatus.PENDING,
      planId: proPlan.id,
    },
  });

  console.log("✅ Sample Pending Organization Created");
  console.log("🎉 Seeding Completed Successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
