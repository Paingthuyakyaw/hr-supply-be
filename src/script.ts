import { prisma } from "../lib/prisma";
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

async function main() {
  console.log("🌱 Seeding started (Full Reset Mode)...");

  // ============================
  // 1️⃣ Create Menus
  // ============================
  console.log("Creating Menus...");
  const menuData = Object.values(MenuCode).map((code) => ({
    menu: code,
    action: [Action.VIEW, Action.CREATE, Action.UPDATE, Action.DELETE], // Master menu definitions
  }));

  // Batch create menus
  await prisma.menu.createMany({ data: menuData });
  const allMenus = await prisma.menu.findMany();
  console.log(`✅ ${allMenus.length} Menus Created`);

  // ============================
  // 2️⃣ Create Plans
  // ============================
  const freePlan = await prisma.plan.create({
    data: { name: "Free Plan", code: PlanCode.FREE },
  });

  const proPlan = await prisma.plan.create({
    data: { name: "Pro Plan", code: PlanCode.PRO },
  });

  const enterprisePlan = await prisma.plan.create({
    data: { name: "Enterprise Plan", code: PlanCode.ENTERPRISE },
  });

  console.log("✅ Plans Created");

  // ============================
  // 3️⃣ Assign Plan Permissions (The Ceiling)
  // ============================

  // Free Plan: Only VIEW for all menus
  for (const menu of allMenus) {
    await prisma.planOnMenu.create({
      data: {
        planId: freePlan.id,
        menuId: menu.id,
        actions: [Action.VIEW],
      },
    });
  }

  // Pro Plan: VIEW, CREATE, UPDATE for all menus
  for (const menu of allMenus) {
    await prisma.planOnMenu.create({
      data: {
        planId: proPlan.id,
        menuId: menu.id,
        actions: [Action.VIEW, Action.CREATE, Action.UPDATE],
      },
    });
  }

  // Enterprise Plan: All actions
  for (const menu of allMenus) {
    await prisma.planOnMenu.create({
      data: {
        planId: enterprisePlan.id,
        menuId: menu.id,
        actions: [Action.VIEW, Action.CREATE, Action.UPDATE, Action.DELETE],
      },
    });
  }

  console.log("✅ Plan-level Restrictions Set");

  // ============================
  // 4️⃣ Create Organization (Linked to PRO Plan)
  // ============================
  const org = await prisma.organization.create({
    data: {
      name: "Nexus Tech Solutions",
      total_employees: 20,
      status: OrganizationStatus.APPROVED,
      planId: proPlan.id,
    },
  });

  // ============================
  // 5️⃣ Create Designations
  // ============================
  const adminRole = await prisma.designation.create({
    data: { name: "Admin", organizationId: org.id },
  });

  const staffRole = await prisma.designation.create({
    data: { name: "General Staff", organizationId: org.id },
  });

  // ============================
  // 6️⃣ Assign Designation Permissions (Based on Plan)
  // ============================

  // Admin gets everything the PRO plan allows
  const proPlanLimits = await prisma.planOnMenu.findMany({
    where: { planId: proPlan.id },
  });

  for (const limit of proPlanLimits) {
    await prisma.designationOnMenu.create({
      data: {
        designationId: adminRole.id,
        menuId: limit.menuId,
        actions: limit.actions, // Matches Pro Plan: [VIEW, CREATE, UPDATE]
      },
    });

    // Staff only gets VIEW, even if the plan allows more
    await prisma.designationOnMenu.create({
      data: {
        designationId: staffRole.id,
        menuId: limit.menuId,
        actions: [Action.VIEW],
      },
    });
  }

  console.log("✅ Designation Permissions Assigned (Plan-compliant)");

  // ============================
  // 7️⃣ Departments & Positions
  // ============================
  const itDept = await prisma.department.create({
    data: {
      name: "Engineering",
      is_active: true,
      employee_count: 0,
      location: "Building A",
      organizationId: org.id,
      startTime: new Date("1970-01-01T09:00:00Z"),
      endTime: new Date("1970-01-01T18:00:00Z"),
      working_days: [
        WeekDay.MON,
        WeekDay.TUE,
        WeekDay.WED,
        WeekDay.THU,
        WeekDay.FRI,
      ],
    },
  });

  const leadDev = await prisma.position.create({
    data: {
      name: "Lead Developer",
      is_active: true,
      department_id: itDept.id,
      organizationId: org.id,
    },
  });

  // ============================
  // 8️⃣ Employees & Role Linking
  // ============================
  const employee = await prisma.employee.create({
    data: {
      full_name: "John Doe",
      code: "EMP-001",
      email: "john@nexus.com",
      organizationId: org.id,
      department_id: itDept.id,
      position_id: leadDev.id,
      location: "Yangon",
      status: EmployeeStatus.ACTIVE,
    },
  });

  // Link Employee to Admin Designation
  await prisma.designationOnEmployee.create({
    data: {
      employeeId: employee.id,
      designationId: adminRole.id,
    },
  });

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
