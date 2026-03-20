/**
 * OpenAPI 3.0 spec for HR Supply Backend
 * Swagger UI: /api/docs
 */

function ref(s: string) {
  return { $ref: s };
}

const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "HR Supply Backend API",
    version: "1.0.0",
    description:
      "API documentation for HR Supply - Auth, Employees, Departments, Positions",
  },
  servers: [{ url: "/api", description: "API Base" }],
  paths: {
    "/": {
      get: {
        summary: "Health / Hello",
        tags: ["General"],
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/HelloResponse"),
              },
            },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/LoginRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LoginResponse"),
              },
            },
          },
          "400": { description: "Email and password are required" },
          "401": { description: "Invalid email or password" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Refresh access token",
        tags: ["Auth"],
        requestBody: {
          content: {
            "application/json": {
              schema: ref("#/components/schemas/RefreshRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Token refreshed",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/RefreshResponse"),
              },
            },
          },
          "400": { description: "Refresh token is required" },
          "401": { description: "Invalid or expired refresh token" },
          "404": { description: "Employee not found" },
        },
      },
    },
    "/employees": {
      get: {
        summary: "List employees",
        tags: ["Employees"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
            description: "Page number",
          },
          {
            name: "size",
            in: "query",
            schema: { type: "integer", default: 20 },
            description: "Page size",
          },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Search by name, code, email, phone",
          },
          {
            name: "department_id",
            in: "query",
            schema: { type: "integer" },
            description: "Filter by department ID",
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of employees",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/EmployeeListResponse"),
              },
            },
          },
          "500": { description: "Server error" },
        },
      },
      post: {
        summary: "Create employee",
        tags: ["Employees"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/EmployeeCreate"),
            },
          },
        },
        responses: {
          "201": {
            description: "Employee created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/EmployeeDataResponse"),
              },
            },
          },
          "500": { description: "Server error" },
        },
      },
    },
    "/employees/{id}": {
      get: {
        summary: "Get employee by ID",
        tags: ["Employees"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "Employee details",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/EmployeeDataResponse"),
              },
            },
          },
          "400": { description: "Invalid id" },
          "404": { description: "Employee not found" },
          "500": { description: "Server error" },
        },
      },
      put: {
        summary: "Update employee",
        tags: ["Employees"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: ref("#/components/schemas/EmployeeUpdate"),
            },
          },
        },
        responses: {
          "200": {
            description: "Employee updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/EmployeeDataResponse"),
              },
            },
          },
          "400": { description: "Invalid id" },
          "404": { description: "Employee not found" },
          "500": { description: "Server error" },
        },
      },
      delete: {
        summary: "Delete employee",
        tags: ["Employees"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "204": { description: "Employee deleted" },
          "400": { description: "Invalid id" },
          "404": { description: "Employee not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/departments": {
      get: {
        summary: "List departments",
        tags: ["Departments"],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "size",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Search by name or location",
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of departments",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/DepartmentListResponse"),
              },
            },
          },
          "500": { description: "Server error" },
        },
      },
      post: {
        summary: "Create department",
        tags: ["Departments"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/DepartmentCreate"),
            },
          },
        },
        responses: {
          "201": {
            description: "Department created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/DepartmentDataResponse"),
              },
            },
          },
          "500": { description: "Server error" },
        },
      },
    },
    "/departments/{id}": {
      get: {
        summary: "Get department by ID",
        tags: ["Departments"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "Department details",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/DepartmentDataResponse"),
              },
            },
          },
          "400": { description: "Invalid id" },
          "404": { description: "Department not found" },
          "500": { description: "Server error" },
        },
      },
      put: {
        summary: "Update department",
        tags: ["Departments"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: ref("#/components/schemas/DepartmentUpdate"),
            },
          },
        },
        responses: {
          "200": {
            description: "Department updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/DepartmentDataResponse"),
              },
            },
          },
          "400": { description: "Invalid id" },
          "404": { description: "Department not found" },
          "500": { description: "Server error" },
        },
      },
      delete: {
        summary: "Delete department",
        tags: ["Departments"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "204": { description: "Department deleted" },
          "400": { description: "Invalid id" },
          "404": { description: "Department not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/positions": {
      get: {
        summary: "List positions",
        tags: ["Positions"],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "size",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Search by name",
          },
          {
            name: "department_id",
            in: "query",
            schema: { type: "integer" },
            description: "Filter by department ID",
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of positions",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PositionListResponse"),
              },
            },
          },
          "500": { description: "Server error" },
        },
      },
      post: {
        summary: "Create position",
        tags: ["Positions"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/PositionCreate"),
            },
          },
        },
        responses: {
          "201": {
            description: "Position created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PositionDataResponse"),
              },
            },
          },
          "500": { description: "Server error" },
        },
      },
    },
    "/positions/{id}": {
      get: {
        summary: "Get position by ID",
        tags: ["Positions"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "Position details",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PositionDataResponse"),
              },
            },
          },
          "400": { description: "Invalid id" },
          "404": { description: "Position not found" },
          "500": { description: "Server error" },
        },
      },
      put: {
        summary: "Update position",
        tags: ["Positions"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: ref("#/components/schemas/PositionUpdate"),
            },
          },
        },
        responses: {
          "200": {
            description: "Position updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PositionDataResponse"),
              },
            },
          },
          "400": { description: "Invalid id" },
          "404": { description: "Position not found" },
          "500": { description: "Server error" },
        },
      },
      delete: {
        summary: "Delete position",
        tags: ["Positions"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "204": { description: "Position deleted" },
          "400": { description: "Invalid id" },
          "404": { description: "Position not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/organization": {
      get: {
        summary: "List organizations",
        tags: ["Organization"],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "size",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Search by organization name",
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
            },
            description: "Filter by status",
          },
        ],
        responses: {
          "200": {
            description: "Organization Fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/OrganizationListResponse"),
              },
            },
          },
          "500": { description: "Something Wrong" },
        },
      },
      post: {
        summary: "Create organization",
        tags: ["Organization"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/OrganizationCreateRequest"),
            },
          },
        },
        responses: {
          "201": {
            description: "Organization created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/OrganizationCreateResponse"),
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/ValidationError"),
              },
            },
          },
          "500": { description: "Something Wrong" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      HelloResponse: {
        type: "object",
        properties: { message: { type: "string", example: "HELLO WORLD" } },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: { type: "object", description: "Employee object" },
          tokens: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              refreshToken: { type: "string" },
            },
          },
        },
      },
      RefreshRequest: {
        type: "object",
        properties: { refreshToken: { type: "string" } },
      },
      RefreshResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: { type: "object" },
          tokens: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              refreshToken: { type: "string" },
            },
          },
        },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: { type: "integer" },
          size: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      EmployeeCreate: {
        type: "object",
        required: [
          "full_name",
          "code",
          "location",
          "department_id",
          "organizationId",
        ],
        properties: {
          full_name: { type: "string" },
          avatar: { type: "string" },
          code: { type: "string" },
          email: { type: "string" },
          phoneNumber: { type: "string" },
          password: { type: "string" },
          dob: { type: "string", format: "date-time" },
          employment_type: {
            type: "string",
            enum: ["PART_TIME", "FULL_TIME", "HYBRID"],
          },
          status: {
            type: "string",
            enum: [
              "ACTIVE",
              "ON_PROBATION",
              "PENDING",
              "ON_LEAVE",
              "SUSPENDED",
              "RESIGNED",
              "TERMINATED",
              "RETIRED",
            ],
          },
          location: { type: "string" },
          date_joined: { type: "string", format: "date-time" },
          department_id: { type: "integer" },
          organizationId: { type: "integer" },
        },
      },
      EmployeeUpdate: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          avatar: { type: "string" },
          code: { type: "string" },
          email: { type: "string" },
          phoneNumber: { type: "string" },
          password: { type: "string" },
          dob: { type: "string", format: "date-time" },
          employment_type: {
            type: "string",
            enum: ["PART_TIME", "FULL_TIME", "HYBRID"],
          },
          status: {
            type: "string",
            enum: [
              "ACTIVE",
              "ON_PROBATION",
              "PENDING",
              "ON_LEAVE",
              "SUSPENDED",
              "RESIGNED",
              "TERMINATED",
              "RETIRED",
            ],
          },
          location: { type: "string" },
          department_id: { type: "integer" },
        },
      },
      EmployeeDataResponse: {
        type: "object",
        properties: { data: { type: "object", description: "Employee" } },
      },
      EmployeeListResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { type: "object" } },
          meta: ref("#/components/schemas/PaginationMeta"),
        },
      },
      DepartmentCreate: {
        type: "object",
        required: [
          "name",
          "is_active",
          "employee_count",
          "location",
          "startTime",
          "endTime",
          "working_days",
          "organizationId",
        ],
        properties: {
          name: { type: "string" },
          is_active: { type: "boolean" },
          head_employee_id: { type: "integer" },
          employee_count: { type: "integer" },
          location: { type: "string" },
          annual_budget: { type: "string" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          working_days: {
            type: "array",
            items: {
              type: "string",
              enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            },
          },
          organizationId: { type: "integer" },
        },
      },
      DepartmentUpdate: {
        type: "object",
        properties: {
          name: { type: "string" },
          is_active: { type: "boolean" },
          head_employee_id: { type: "integer" },
          employee_count: { type: "integer" },
          location: { type: "string" },
          annual_budget: { type: "string" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          working_days: {
            type: "array",
            items: {
              type: "string",
              enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            },
          },
        },
      },
      DepartmentDataResponse: {
        type: "object",
        properties: { data: { type: "object", description: "Department" } },
      },
      DepartmentListResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { type: "object" } },
          meta: ref("#/components/schemas/PaginationMeta"),
        },
      },
      PositionCreate: {
        type: "object",
        required: ["name", "is_active", "department_id", "organizationId"],
        properties: {
          name: { type: "string" },
          is_active: { type: "boolean" },
          department_id: { type: "integer" },
          organizationId: { type: "integer" },
          avg_salary: { type: "integer" },
          min_salary: { type: "integer" },
          max_salary: { type: "integer" },
        },
      },
      PositionUpdate: {
        type: "object",
        properties: {
          name: { type: "string" },
          is_active: { type: "boolean" },
          department_id: { type: "integer" },
          avg_salary: { type: "integer" },
          min_salary: { type: "integer" },
          max_salary: { type: "integer" },
        },
      },
      PositionDataResponse: {
        type: "object",
        properties: { data: { type: "object", description: "Position" } },
      },
      PositionListResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { type: "object" } },
          meta: ref("#/components/schemas/PaginationMeta"),
        },
      },
      Organization: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          total_employees: { type: "integer" },
          status: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
          },
          expire_time: { type: "string", format: "date-time", nullable: true },
          planId: { type: "integer" },
        },
      },
      OrganizationListResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Organization Fetched" },
          data: {
            type: "array",
            items: ref("#/components/schemas/Organization"),
          },
          meta: ref("#/components/schemas/PaginationMeta"),
        },
      },
      OrganizationCreateRequest: {
        type: "object",
        required: ["name", "status", "planId"],
        properties: {
          name: { type: "string" },
          // Note: validator file uses `total_employment` but Prisma model uses `total_employees`.
          // We document the intended Prisma field, plus the current validator field for compatibility.
          total_employees: {
            type: "integer",
            description: "Total employees limit/count",
          },
          total_employment: {
            type: "integer",
            description:
              "Deprecated/compat alias used by current validator (prefer total_employees)",
          },
          status: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"],
          },
          expire_time: { type: "string", format: "date-time", nullable: true },
          planId: { type: "integer" },
        },
      },
      OrganizationCreateResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Organization Created" },
          data: ref("#/components/schemas/Organization"),
        },
      },
      ValidationError: {
        type: "object",
        properties: {
          message: { type: "string", example: "Validation Error" },
          errors: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
};

export { openApiSpec };
