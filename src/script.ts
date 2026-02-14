import { EmployeType, WeekDay } from "./generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { faker } from "@faker-js/faker";

async function main() {
  // 1️⃣ Create Departments
  const departments = await prisma.department.createMany({
    data: [
      {
        name: "Marketing",
        is_active: true,
        head_employee_id: 1, // later update လုပ်နိုင်
        employee_count: 0,
        location: "Yangon",
        annual_budget: "500000",
        startTime: new Date("1970-01-01T09:00:00"),
        endTime: new Date("1970-01-01T18:00:00"),
        working_days: [
          WeekDay.MON,
          WeekDay.TUE,
          WeekDay.WED,
          WeekDay.THU,
          WeekDay.FRI,
        ],
      },
      {
        name: "IT",
        is_active: true,
        head_employee_id: 2,
        employee_count: 0,
        location: "Mandalay",
        annual_budget: "800000",
        startTime: new Date("1970-01-01T09:30:00"),
        endTime: new Date("1970-01-01T18:30:00"),
        working_days: [
          WeekDay.MON,
          WeekDay.TUE,
          WeekDay.WED,
          WeekDay.THU,
          WeekDay.FRI,
        ],
      },
    ],
  });

  console.log("✅ Departments Created");

  const allDepartments = await prisma.department.findMany();

  // 2️⃣ Create Positions
  for (const dept of allDepartments) {
    await prisma.position.createMany({
      data: [
        {
          name: `${dept.name} Manager`,
          is_active: true,
          department_id: dept.id,
          min_salary: 50000,
          max_salary: 90000,
          avg_salary: 70000,
        },
        {
          name: `${dept.name} Executive`,
          is_active: true,
          department_id: allDepartments[1].id,
          min_salary: 30000,
          max_salary: 60000,
          avg_salary: 45000,
        },
      ],
    });
  }

  console.log("✅ Positions Created");

  const allPositions = await prisma.position.findMany();

  // 3️⃣ Create 20 Employees
  const employees = [];

  for (let i = 0; i < 20; i++) {
    const randomDept = faker.helpers.arrayElement(allDepartments);
    const deptPositions = allPositions.filter(
      (p) => p.department_id === randomDept.id,
    );
    const randomPosition = faker.helpers.arrayElement(deptPositions);

    employees.push({
      full_name: faker.person.fullName(),
      avatar: faker.image.avatar(),
      code: `EMP${1000 + i}`,
      email: faker.internet.email(),
      phoneNumber: faker.phone.number(),
      dob: faker.date.birthdate({ min: 22, max: 45, mode: "age" }),
      employment_type: faker.helpers.arrayElement([
        EmployeType.FULL_TIME,
        EmployeType.PART_TIME,
        EmployeType.HYBRID,
      ]),
      department_id: randomDept.id,
      position_id: randomPosition.id,
      location: faker.location.city(),
      date_joined: faker.date.past({ years: 3 }),
    });
  }

  await prisma.employee.createMany({
    data: employees,
  });

  console.log("✅ 20 Employees Created");

  // 4️⃣ Update employee_count
  for (const dept of allDepartments) {
    const count = await prisma.employee.count({
      where: { department_id: dept.id },
    });

    await prisma.department.update({
      where: { id: dept.id },
      data: { employee_count: count },
    });
  }

  console.log("✅ Employee Count Updated");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
