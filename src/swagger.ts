/**
 * OpenAPI 3.0 spec for HR Supply Backend
 * Swagger UI: /api/docs  ·  Spec JSON: /api/openapi
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
  tags: [
    { name: "Admin - Employees" },
    { name: "Admin - Organization" },
    { name: "Admin - Departments" },
    { name: "Admin - Positions" },
    { name: "Admin - Plan" },
    { name: "Admin - Leave" },
    { name: "Admin - Payroll" },
    { name: "Admin - Uploads" },
    { name: "Admin - Attendance" },
    { name: "Leave" },
    { name: "Attendance" },
    { name: "Auth" },
    { name: "General" },
  ],
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
    "/admin/employees": {
      get: {
        summary: "List employees",
        tags: ["Admin - Employees"],
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
        tags: ["Admin - Employees"],
        security: [{ bearerAuth: [] }],
        description:
          "Create employee profile. For file fields, first call /admin/uploads/presign, upload file to returned uploadUrl, then pass fileUrl as avatarUrl, contracts[] or documents[].frontUrl/backUrl.",
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
          "400": { description: "Invalid payload" },
          "500": { description: "Server error" },
        },
      },
    },
    "/admin/employees/{id}": {
      get: {
        summary: "Get employee by ID",
        tags: ["Admin - Employees"],
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
        tags: ["Admin - Employees"],
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
        tags: ["Admin - Employees"],
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
            description: "Employee deleted",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/DeleteByIdResponse"),
              },
            },
          },
          "400": { description: "Invalid id" },
          "404": { description: "Employee not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/admin/employees/{id}/lifecycle": {
      patch: {
        summary: "Transition employee lifecycle status",
        tags: ["Admin - Employees"],
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
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/EmployeeLifecycleTransitionRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Lifecycle updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/EmployeeDataResponse"),
              },
            },
          },
          "400": { description: "Invalid transition or payload" },
          "404": { description: "Employee not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/admin/employees/{id}/contracts": {
      get: {
        summary: "List employee contract versions",
        tags: ["Admin - Employees"],
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
            description: "Employee contracts fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/EmployeeContractListResponse"),
              },
            },
          },
          "404": { description: "Employee not found" },
          "500": { description: "Server error" },
        },
      },
      post: {
        summary: "Create new employee contract version",
        tags: ["Admin - Employees"],
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
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/EmployeeContractCreateRequest"),
            },
          },
        },
        responses: {
          "201": {
            description: "Employee contract created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/EmployeeContractDataResponse"),
              },
            },
          },
          "400": { description: "Invalid payload" },
          "404": { description: "Employee not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/admin/employees/{id}/contracts/{contractId}": {
      patch: {
        summary: "Update employee contract version",
        tags: ["Admin - Employees"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "contractId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/EmployeeContractUpdateRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Employee contract updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/EmployeeContractDataResponse"),
              },
            },
          },
          "400": { description: "Invalid payload" },
          "404": { description: "Contract not found" },
          "500": { description: "Server error" },
        },
      },
    },
    "/admin/uploads/presign": {
      post: {
        summary: "Create presigned upload URL (R2)",
        tags: ["Admin - Uploads"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/UploadPresignRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Presigned upload URL generated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/UploadPresignResponse"),
              },
            },
          },
          "400": { description: "Validation or policy error" },
          "401": { description: "Unauthorized" },
          "500": { description: "Failed to generate upload URL" },
        },
      },
    },
    "/admin/organization/{id}/schedule": {
      get: {
        summary: "Get organization working schedule",
        tags: ["Admin - Organization"],
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
            description: "Organization schedule fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/OrganizationScheduleResponse"),
              },
            },
          },
          "404": { description: "Organization not found" },
        },
      },
      put: {
        summary: "Update organization working schedule",
        tags: ["Admin - Organization"],
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
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/OrganizationScheduleUpdateRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Organization schedule updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/OrganizationScheduleResponse"),
              },
            },
          },
          "400": { description: "Invalid payload" },
          "404": { description: "Organization not found" },
        },
      },
    },
    "/admin/departments": {
      get: {
        summary: "List departments",
        tags: ["Admin - Departments"],
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
        tags: ["Admin - Departments"],
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
    "/admin/departments/{id}": {
      get: {
        summary: "Get department by ID",
        tags: ["Admin - Departments"],
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
        tags: ["Admin - Departments"],
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
        tags: ["Admin - Departments"],
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
    "/admin/positions": {
      get: {
        summary: "List positions",
        tags: ["Admin - Positions"],
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
        tags: ["Admin - Positions"],
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
    "/admin/positions/{id}": {
      get: {
        summary: "Get position by ID",
        tags: ["Admin - Positions"],
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
        tags: ["Admin - Positions"],
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
        tags: ["Admin - Positions"],
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
    "/admin/organization": {
      get: {
        summary: "List organizations",
        tags: ["Admin - Organization"],
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
        tags: ["Admin - Organization"],
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
    "/admin/plan": {
      get: {
        summary: "Plan Listing",
        tags: ["Admin - Plan"],
        responses: {
          "200": {
            description: "Plan Fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PlanListResponse"),
              },
            },
          },
          "500": { description: "Something Wrong" },
        },
      },
    },
    "/leave/balances": {
      get: {
        summary: "List my leave balances",
        tags: ["Leave"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "year",
            in: "query",
            schema: { type: "integer", example: 2026 },
          },
        ],
        responses: {
          "200": {
            description: "Leave balances fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveBalanceListResponse"),
              },
            },
          },
        },
      },
    },
    "/leave/requests": {
      get: {
        summary: "List my leave requests",
        tags: ["Leave"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] },
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "size", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "Leave requests fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveRequestListResponse"),
              },
            },
          },
        },
      },
      post: {
        summary: "Create leave request",
        tags: ["Leave"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/LeaveRequestCreate"),
            },
          },
        },
        responses: {
          "201": {
            description: "Leave request created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveRequestDataResponse"),
              },
            },
          },
        },
      },
    },
    "/leave/requests/{id}/cancel": {
      patch: {
        summary: "Cancel my pending leave request",
        tags: ["Leave"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Leave request cancelled",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveRequestDataResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/leave/types": {
      get: {
        summary: "List leave types",
        tags: ["Admin - Leave"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Leave types fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveTypeListResponse"),
              },
            },
          },
        },
      },
      post: {
        summary: "Create leave type",
        tags: ["Admin - Leave"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/LeaveTypeCreate"),
            },
          },
        },
        responses: {
          "201": {
            description: "Leave type created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveTypeDataResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/leave/types/{id}": {
      patch: {
        summary: "Update leave type",
        tags: ["Admin - Leave"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/LeaveTypeUpdate"),
            },
          },
        },
        responses: {
          "200": {
            description: "Leave type updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveTypeDataResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/leave/holidays": {
      get: {
        summary: "List holiday calendar",
        tags: ["Admin - Leave"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "year",
            in: "query",
            schema: { type: "integer", example: 2026 },
          },
        ],
        responses: {
          "200": {
            description: "Holidays fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/HolidayListResponse"),
              },
            },
          },
        },
      },
      post: {
        summary: "Create holiday",
        tags: ["Admin - Leave"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/HolidayCreate"),
            },
          },
        },
        responses: {
          "201": {
            description: "Holiday created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/HolidayDataResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/leave/requests": {
      get: {
        summary: "List leave requests (admin)",
        tags: ["Admin - Leave"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] },
          },
          {
            name: "employeeId",
            in: "query",
            schema: { type: "integer" },
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "size", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "Leave requests fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveRequestListResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/leave/requests/{id}/decision": {
      post: {
        summary: "Approve or reject leave request",
        tags: ["Admin - Leave"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/LeaveDecisionRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Leave request updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveRequestDataResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/leave/carry-forward": {
      post: {
        summary: "Run leave carry-forward",
        tags: ["Admin - Leave"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: ref("#/components/schemas/LeaveCarryForwardRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Carry-forward completed",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/LeaveCarryForwardResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/payroll/components": {
      get: {
        summary: "List payroll components",
        tags: ["Admin - Payroll"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "type",
            in: "query",
            schema: { type: "string", enum: ["EARNING", "DEDUCTION"] },
          },
        ],
        responses: {
          "200": {
            description: "Payroll components fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PayrollComponentListResponse"),
              },
            },
          },
        },
      },
      post: {
        summary: "Create payroll component",
        tags: ["Admin - Payroll"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/PayrollComponentCreate"),
            },
          },
        },
        responses: {
          "201": {
            description: "Payroll component created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PayrollComponentDataResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/payroll/components/{id}": {
      patch: {
        summary: "Update payroll component",
        tags: ["Admin - Payroll"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/PayrollComponentUpdate"),
            },
          },
        },
        responses: {
          "200": {
            description: "Payroll component updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PayrollComponentDataResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/payroll/runs": {
      post: {
        summary: "Run payroll for month",
        tags: ["Admin - Payroll"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/PayrollRunCreate"),
            },
          },
        },
        responses: {
          "201": {
            description: "Payroll run completed",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PayrollRunExecuteResponse"),
              },
            },
          },
        },
      },
      get: {
        summary: "List payroll runs",
        tags: ["Admin - Payroll"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["DRAFT", "FINALIZED", "EXPORTED"] },
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "size", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "Payroll runs fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PayrollRunListResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/payroll/runs/{id}/summary": {
      get: {
        summary: "Get payroll run summary",
        tags: ["Admin - Payroll"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Payroll summary fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PayrollSummaryResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/payroll/runs/{id}/export": {
      post: {
        summary: "Export payroll run payslip CSV",
        tags: ["Admin - Payroll"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "Payroll export generated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/PayrollExportResponse"),
              },
            },
          },
        },
      },
    },
    "/attendance/check-in": {
      post: {
        summary: "Employee check in",
        tags: ["Attendance"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: ref("#/components/schemas/AttendanceCheckInOutRequest"),
            },
          },
        },
        responses: {
          "201": {
            description: "Checked in",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/AttendanceRecordDataResponse"),
              },
            },
          },
          "400": { description: "Already checked in or setup missing" },
        },
      },
    },
    "/attendance/check-out": {
      post: {
        summary: "Employee check out",
        tags: ["Attendance"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: ref("#/components/schemas/AttendanceCheckInOutRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Checked out",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/AttendanceRecordDataResponse"),
              },
            },
          },
          "400": { description: "No active check-in found" },
        },
      },
    },
    "/attendance/records": {
      get: {
        summary: "List my attendance records",
        tags: ["Attendance"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "from", in: "query", schema: { type: "string", example: "2026-05-01" } },
          { name: "to", in: "query", schema: { type: "string", example: "2026-05-31" } },
          {
            name: "state",
            in: "query",
            schema: { type: "string", enum: ["OPEN", "CLOSED", "MISSED_CHECK_OUT"] },
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "size", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "Attendance records fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/AttendanceRecordListResponse"),
              },
            },
          },
        },
      },
    },
    "/attendance/approvals": {
      get: {
        summary: "List my attendance approval requests",
        tags: ["Attendance"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] },
          },
          {
            name: "type",
            in: "query",
            schema: {
              type: "string",
              enum: ["OVERTIME", "PAYROLL_ADJUSTMENT"],
            },
          },
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
        ],
        responses: {
          "200": {
            description: "Approvals fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/ApprovalListResponse"),
              },
            },
          },
        },
      },
      post: {
        summary: "Create attendance approval request",
        tags: ["Attendance"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/ApprovalCreateRequest"),
            },
          },
        },
        responses: {
          "201": {
            description: "Approval created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/ApprovalDataResponse"),
              },
            },
          },
          "400": { description: "Invalid payload" },
        },
      },
    },
    "/admin/attendance/policy": {
      get: {
        summary: "Get attendance policy",
        tags: ["Admin - Attendance"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Attendance policy fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/AttendancePolicyResponse"),
              },
            },
          },
        },
      },
      put: {
        summary: "Create or update attendance policy",
        tags: ["Admin - Attendance"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/AttendancePolicyRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Attendance policy saved",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/AttendancePolicyResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/attendance/shifts": {
      get: {
        summary: "List attendance shifts",
        tags: ["Admin - Attendance"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Attendance shifts fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/AttendanceShiftListResponse"),
              },
            },
          },
        },
      },
      post: {
        summary: "Create attendance shift",
        tags: ["Admin - Attendance"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/AttendanceShiftRequest"),
            },
          },
        },
        responses: {
          "201": {
            description: "Attendance shift created",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/AttendanceShiftDataResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/attendance/shifts/{id}": {
      patch: {
        summary: "Update attendance shift",
        tags: ["Admin - Attendance"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/AttendanceShiftUpdateRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Attendance shift updated",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/AttendanceShiftDataResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/attendance/records": {
      get: {
        summary: "List attendance records (admin)",
        tags: ["Admin - Attendance"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "employeeId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", example: "2026-05-01" } },
          { name: "to", in: "query", schema: { type: "string", example: "2026-05-31" } },
          {
            name: "state",
            in: "query",
            schema: { type: "string", enum: ["OPEN", "CLOSED", "MISSED_CHECK_OUT"] },
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "size", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "Attendance records fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/AttendanceRecordListResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/attendance/approvals": {
      get: {
        summary: "List attendance approvals to manage",
        tags: ["Admin - Attendance"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] },
          },
          {
            name: "type",
            in: "query",
            schema: {
              type: "string",
              enum: ["OVERTIME", "PAYROLL_ADJUSTMENT"],
            },
          },
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
        ],
        responses: {
          "200": {
            description: "Approvals fetched",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/ApprovalListResponse"),
              },
            },
          },
        },
      },
    },
    "/admin/attendance/approvals/{id}/decision": {
      post: {
        summary: "Approve or reject current stage",
        tags: ["Admin - Attendance"],
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
          required: true,
          content: {
            "application/json": {
              schema: ref("#/components/schemas/ApprovalDecisionRequest"),
            },
          },
        },
        responses: {
          "200": {
            description: "Decision applied",
            content: {
              "application/json": {
                schema: ref("#/components/schemas/ApprovalDataResponse"),
              },
            },
          },
          "400": { description: "Invalid decision or stage order" },
          "403": { description: "Not current approver" },
          "404": { description: "Approval not found" },
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
          avatarUrl: {
            type: "string",
            description: "Uploaded file URL from /admin/uploads/presign flow",
          },
          contracts: {
            type: "array",
            description: "Employee contract file URLs",
            items: { type: "string" },
          },
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
          documents: {
            type: "array",
            description: "Employee documents (contract, ID, etc.)",
            items: ref("#/components/schemas/EmployeeDocumentInput"),
          },
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
          avatarUrl: { type: "string" },
          contracts: {
            type: "array",
            items: { type: "string" },
          },
          documents: {
            type: "array",
            items: ref("#/components/schemas/EmployeeDocumentInput"),
          },
        },
      },
      EmployeeDocumentInput: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: ["PASSPORT", "DRIVER_LICENSE", "NRC"],
          },
          frontUrl: { type: "string" },
          backUrl: { type: "string" },
        },
      },
      EmployeeDataResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Employee created" },
          data: { type: "object", description: "Employee" },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      EmployeeListResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Employees fetched" },
          data: { type: "array", items: { type: "object" } },
          meta: ref("#/components/schemas/PaginationMeta"),
          error: { nullable: true, type: "object" },
        },
      },
      DeleteByIdResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Employee deleted" },
          data: {
            type: "object",
            properties: {
              id: { type: "integer" },
            },
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      EmployeeLifecycleTransitionRequest: {
        type: "object",
        required: ["status"],
        properties: {
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
        },
      },
      EmployeeContractBase: {
        type: "object",
        properties: {
          id: { type: "integer" },
          employeeId: { type: "integer" },
          fileUrl: { type: "string" },
          version: { type: "integer" },
          status: {
            type: "string",
            enum: ["ACTIVE", "EXPIRED", "TERMINATED"],
          },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          reminderDays: { type: "integer", nullable: true },
          notes: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      EmployeeContractCreateRequest: {
        type: "object",
        required: ["fileUrl"],
        properties: {
          fileUrl: { type: "string" },
          status: {
            type: "string",
            enum: ["ACTIVE", "EXPIRED", "TERMINATED"],
          },
          expiresAt: { type: "string", format: "date-time" },
          reminderDays: { type: "integer" },
          notes: { type: "string" },
        },
      },
      EmployeeContractUpdateRequest: {
        type: "object",
        properties: {
          fileUrl: { type: "string" },
          status: {
            type: "string",
            enum: ["ACTIVE", "EXPIRED", "TERMINATED"],
          },
          expiresAt: {
            oneOf: [
              { type: "string", format: "date-time" },
              { type: "null" },
            ],
          },
          reminderDays: {
            oneOf: [{ type: "integer" }, { type: "null" }],
          },
          notes: {
            oneOf: [{ type: "string" }, { type: "null" }],
          },
        },
      },
      EmployeeContractDataResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: ref("#/components/schemas/EmployeeContractBase"),
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      EmployeeContractListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/EmployeeContractBase"),
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      OrganizationScheduleUpdateRequest: {
        type: "object",
        properties: {
          workingDays: {
            type: "array",
            items: {
              type: "string",
              enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            },
          },
          offDays: {
            type: "array",
            items: {
              type: "string",
              enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            },
          },
        },
      },
      OrganizationScheduleResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              organizationId: { type: "integer" },
              workingDays: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
                },
              },
              offDays: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
                },
              },
            },
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      AttendanceCheckInOutRequest: {
        type: "object",
        properties: {
          notes: { type: "string" },
        },
      },
      AttendancePolicy: {
        type: "object",
        properties: {
          id: { type: "integer" },
          organizationId: { type: "integer" },
          defaultStartTime: { type: "string", format: "date-time" },
          defaultEndTime: { type: "string", format: "date-time" },
          lateGraceMinutes: { type: "integer" },
          earlyLeaveGraceMinutes: { type: "integer" },
          minHalfDayMinutes: { type: "integer" },
        },
      },
      AttendancePolicyRequest: {
        type: "object",
        required: [
          "defaultStartTime",
          "defaultEndTime",
          "lateGraceMinutes",
          "earlyLeaveGraceMinutes",
          "minHalfDayMinutes",
        ],
        properties: {
          defaultStartTime: { type: "string", example: "09:00" },
          defaultEndTime: { type: "string", example: "17:30" },
          lateGraceMinutes: { type: "integer", example: 10 },
          earlyLeaveGraceMinutes: { type: "integer", example: 10 },
          minHalfDayMinutes: { type: "integer", example: 240 },
        },
      },
      AttendancePolicyResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            oneOf: [
              ref("#/components/schemas/AttendancePolicy"),
              { type: "null" },
            ],
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      AttendanceShift: {
        type: "object",
        properties: {
          id: { type: "integer" },
          organizationId: { type: "integer" },
          name: { type: "string" },
          weekdays: {
            type: "array",
            items: {
              type: "string",
              enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            },
          },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          lateGraceMinutes: { type: "integer" },
          earlyLeaveGraceMinutes: { type: "integer" },
          isActive: { type: "boolean" },
          isDefault: { type: "boolean" },
        },
      },
      AttendanceShiftRequest: {
        type: "object",
        required: ["name", "weekdays", "startTime", "endTime"],
        properties: {
          name: { type: "string" },
          weekdays: {
            type: "array",
            items: {
              type: "string",
              enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            },
          },
          startTime: { type: "string", example: "09:00" },
          endTime: { type: "string", example: "17:30" },
          lateGraceMinutes: { type: "integer", example: 10 },
          earlyLeaveGraceMinutes: { type: "integer", example: 10 },
          isActive: { type: "boolean" },
          isDefault: { type: "boolean" },
        },
      },
      AttendanceShiftUpdateRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          weekdays: {
            type: "array",
            items: {
              type: "string",
              enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            },
          },
          startTime: { type: "string", example: "09:00" },
          endTime: { type: "string", example: "17:30" },
          lateGraceMinutes: { type: "integer" },
          earlyLeaveGraceMinutes: { type: "integer" },
          isActive: { type: "boolean" },
          isDefault: { type: "boolean" },
        },
      },
      AttendanceShiftDataResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: ref("#/components/schemas/AttendanceShift"),
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      AttendanceShiftListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/AttendanceShift"),
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      AttendanceRecord: {
        type: "object",
        properties: {
          id: { type: "integer" },
          organizationId: { type: "integer" },
          employeeId: { type: "integer" },
          shiftId: { type: "integer", nullable: true },
          workDate: { type: "string", format: "date-time" },
          checkInAt: { type: "string", format: "date-time", nullable: true },
          checkOutAt: { type: "string", format: "date-time", nullable: true },
          lateMinutes: { type: "integer" },
          earlyLeaveMinutes: { type: "integer" },
          workedMinutes: { type: "integer" },
          status: { type: "string", enum: ["PRESENT", "HALF_DAY", "ABSENT"] },
          recordState: {
            type: "string",
            enum: ["OPEN", "CLOSED", "MISSED_CHECK_OUT"],
          },
          notes: { type: "string", nullable: true },
        },
      },
      AttendanceRecordDataResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: ref("#/components/schemas/AttendanceRecord"),
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      AttendanceRecordListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/AttendanceRecord"),
          },
          meta: ref("#/components/schemas/PaginationMeta"),
          error: { nullable: true, type: "object" },
        },
      },
      LeaveType: {
        type: "object",
        properties: {
          id: { type: "integer" },
          organizationId: { type: "integer" },
          code: { type: "string" },
          name: { type: "string" },
          annualQuotaDays: { type: "integer" },
          carryForwardLimit: { type: "integer" },
          requiresApproval: { type: "boolean" },
          isActive: { type: "boolean" },
        },
      },
      LeaveTypeCreate: {
        type: "object",
        required: ["code", "name", "annualQuotaDays", "carryForwardLimit"],
        properties: {
          code: { type: "string", example: "ANNUAL" },
          name: { type: "string", example: "Annual Leave" },
          annualQuotaDays: { type: "integer", example: 14 },
          carryForwardLimit: { type: "integer", example: 5 },
          requiresApproval: { type: "boolean", example: true },
          isActive: { type: "boolean", example: true },
        },
      },
      LeaveTypeUpdate: {
        type: "object",
        properties: {
          name: { type: "string" },
          annualQuotaDays: { type: "integer" },
          carryForwardLimit: { type: "integer" },
          requiresApproval: { type: "boolean" },
          isActive: { type: "boolean" },
        },
      },
      LeaveTypeDataResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: ref("#/components/schemas/LeaveType"),
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      LeaveTypeListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/LeaveType"),
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      LeaveBalance: {
        type: "object",
        properties: {
          id: { type: "integer" },
          year: { type: "integer" },
          entitledDays: { type: "integer" },
          carriedDays: { type: "integer" },
          usedDays: { type: "integer" },
          remainingDays: { type: "integer" },
          leaveType: ref("#/components/schemas/LeaveType"),
        },
      },
      LeaveBalanceListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/LeaveBalance"),
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      LeaveRequestCreate: {
        type: "object",
        required: ["leaveTypeId", "startDate", "endDate"],
        properties: {
          leaveTypeId: { type: "integer" },
          startDate: { type: "string", example: "2026-06-03" },
          endDate: { type: "string", example: "2026-06-05" },
          reason: { type: "string" },
        },
      },
      LeaveRequestData: {
        type: "object",
        properties: {
          id: { type: "integer" },
          employeeId: { type: "integer" },
          leaveTypeId: { type: "integer" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          totalDays: { type: "integer" },
          reason: { type: "string", nullable: true },
          status: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
          },
          reviewedAt: { type: "string", format: "date-time", nullable: true },
          reviewComment: { type: "string", nullable: true },
        },
      },
      LeaveRequestDataResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: ref("#/components/schemas/LeaveRequestData"),
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      LeaveRequestListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/LeaveRequestData"),
          },
          meta: ref("#/components/schemas/PaginationMeta"),
          error: { nullable: true, type: "object" },
        },
      },
      HolidayCreate: {
        type: "object",
        required: ["date", "name"],
        properties: {
          date: { type: "string", example: "2026-12-25" },
          name: { type: "string", example: "Christmas Day" },
          isOptional: { type: "boolean", example: false },
        },
      },
      Holiday: {
        type: "object",
        properties: {
          id: { type: "integer" },
          organizationId: { type: "integer" },
          date: { type: "string", format: "date-time" },
          name: { type: "string" },
          isOptional: { type: "boolean" },
        },
      },
      HolidayDataResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: ref("#/components/schemas/Holiday"),
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      HolidayListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/Holiday"),
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      LeaveDecisionRequest: {
        type: "object",
        required: ["decision"],
        properties: {
          decision: { type: "string", enum: ["APPROVE", "REJECT"] },
          comment: { type: "string" },
        },
      },
      LeaveCarryForwardRequest: {
        type: "object",
        properties: {
          fromYear: { type: "integer", example: 2026 },
        },
      },
      LeaveCarryForwardResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              fromYear: { type: "integer" },
              toYear: { type: "integer" },
              processed: { type: "integer" },
            },
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      PayrollComponent: {
        type: "object",
        properties: {
          id: { type: "integer" },
          organizationId: { type: "integer" },
          code: { type: "string" },
          name: { type: "string" },
          type: { type: "string", enum: ["EARNING", "DEDUCTION"] },
          calculationType: { type: "string", enum: ["FIXED", "PERCENTAGE"] },
          value: { type: "number" },
          isTaxable: { type: "boolean" },
          isActive: { type: "boolean" },
        },
      },
      PayrollComponentCreate: {
        type: "object",
        required: ["code", "name", "type", "calculationType", "value"],
        properties: {
          code: { type: "string", example: "BASIC" },
          name: { type: "string", example: "Basic Salary" },
          type: { type: "string", enum: ["EARNING", "DEDUCTION"] },
          calculationType: { type: "string", enum: ["FIXED", "PERCENTAGE"] },
          value: { type: "number", example: 500000 },
          isTaxable: { type: "boolean", example: true },
          isActive: { type: "boolean", example: true },
        },
      },
      PayrollComponentUpdate: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["EARNING", "DEDUCTION"] },
          calculationType: { type: "string", enum: ["FIXED", "PERCENTAGE"] },
          value: { type: "number" },
          isTaxable: { type: "boolean" },
          isActive: { type: "boolean" },
        },
      },
      PayrollComponentDataResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: ref("#/components/schemas/PayrollComponent"),
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      PayrollComponentListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/PayrollComponent"),
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      PayrollRunCreate: {
        type: "object",
        required: ["month"],
        properties: {
          month: { type: "string", example: "2026-06" },
          notes: { type: "string" },
        },
      },
      PayrollRunBase: {
        type: "object",
        properties: {
          id: { type: "integer" },
          organizationId: { type: "integer" },
          month: { type: "string" },
          status: { type: "string", enum: ["DRAFT", "FINALIZED", "EXPORTED"] },
          notes: { type: "string", nullable: true },
          processedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      PayrollRunExecuteResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              run: ref("#/components/schemas/PayrollRunBase"),
              employees: { type: "integer" },
            },
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      PayrollRunListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/PayrollRunBase"),
          },
          meta: ref("#/components/schemas/PaginationMeta"),
          error: { nullable: true, type: "object" },
        },
      },
      PayrollSummaryResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              run: ref("#/components/schemas/PayrollRunBase"),
              employees: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    employeeId: { type: "integer" },
                    employeeCode: { type: "string" },
                    employeeName: { type: "string" },
                    netPay: { type: "number" },
                  },
                },
              },
              totals: {
                type: "object",
                properties: {
                  employees: { type: "integer" },
                  totalNetPay: { type: "number" },
                },
              },
            },
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      PayrollExportResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              fileName: { type: "string" },
              contentType: { type: "string", example: "text/csv" },
              content: { type: "string" },
            },
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      ApprovalStage: {
        type: "object",
        properties: {
          id: { type: "integer" },
          stepOrder: { type: "integer" },
          approverId: { type: "integer" },
          status: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED"],
          },
          actedAt: { type: "string", format: "date-time", nullable: true },
          comment: { type: "string", nullable: true },
        },
      },
      ApprovalRequestData: {
        type: "object",
        properties: {
          id: { type: "integer" },
          organizationId: { type: "integer" },
          type: {
            type: "string",
            enum: ["OVERTIME", "PAYROLL_ADJUSTMENT"],
          },
          status: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
          },
          requesterId: { type: "integer" },
          targetEmployeeId: { type: "integer", nullable: true },
          currentStep: { type: "integer" },
          steps: {
            type: "array",
            items: ref("#/components/schemas/ApprovalStage"),
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      OvertimeApprovalPayload: {
        type: "object",
        required: ["workDate", "startTime", "endTime", "totalHours", "reason"],
        properties: {
          workDate: { type: "string", example: "2026-05-24" },
          startTime: { type: "string", example: "18:30" },
          endTime: { type: "string", example: "21:30" },
          totalHours: { type: "number", example: 3 },
          reason: { type: "string" },
        },
      },
      PayrollAdjustmentApprovalPayload: {
        type: "object",
        required: [
          "adjustmentType",
          "amount",
          "currency",
          "effectiveMonth",
          "reason",
        ],
        properties: {
          adjustmentType: {
            type: "string",
            enum: ["BONUS", "DEDUCTION", "ALLOWANCE", "CORRECTION"],
          },
          amount: { type: "number", example: 50000 },
          currency: { type: "string", example: "MMK" },
          effectiveMonth: { type: "string", example: "2026-05" },
          reason: { type: "string" },
        },
      },
      ApprovalCreateBase: {
        type: "object",
        required: [],
        properties: {
          targetEmployeeId: {
            type: "integer",
            minimum: 1,
            description:
              "Optional. If omitted, requester itself becomes target employee.",
          },
        },
      },
      ApprovalCreateOvertimeRequest: {
        allOf: [
          ref("#/components/schemas/ApprovalCreateBase"),
          {
            type: "object",
            required: ["type", "payload"],
            properties: {
              type: { type: "string", enum: ["OVERTIME"] },
              payload: ref("#/components/schemas/OvertimeApprovalPayload"),
            },
          },
        ],
      },
      ApprovalCreatePayrollAdjustmentRequest: {
        allOf: [
          ref("#/components/schemas/ApprovalCreateBase"),
          {
            type: "object",
            required: ["type", "payload"],
            properties: {
              type: { type: "string", enum: ["PAYROLL_ADJUSTMENT"] },
              payload: ref("#/components/schemas/PayrollAdjustmentApprovalPayload"),
            },
          },
        ],
      },
      ApprovalCreateRequest: {
        oneOf: [
          ref("#/components/schemas/ApprovalCreateOvertimeRequest"),
          ref("#/components/schemas/ApprovalCreatePayrollAdjustmentRequest"),
        ],
      },
      ApprovalDecisionRequest: {
        type: "object",
        required: ["decision"],
        properties: {
          decision: {
            type: "string",
            enum: ["APPROVE", "REJECT"],
          },
          comment: { type: "string" },
        },
      },
      ApprovalDataResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: ref("#/components/schemas/ApprovalRequestData"),
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
        },
      },
      ApprovalListResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
          data: {
            type: "array",
            items: ref("#/components/schemas/ApprovalRequestData"),
          },
          meta: ref("#/components/schemas/PaginationMeta"),
          error: { nullable: true, type: "object" },
        },
      },
      UploadPresignRequest: {
        type: "object",
        required: ["purpose", "fileName", "contentType", "size"],
        properties: {
          purpose: {
            type: "string",
            enum: [
              "employee_avatar",
              "employee_id_front",
              "employee_id_back",
              "employee_contract",
            ],
          },
          fileName: { type: "string", example: "nrc-front.jpg" },
          contentType: { type: "string", example: "image/jpeg" },
          size: {
            type: "integer",
            description: "File size in bytes",
            example: 512000,
          },
        },
      },
      UploadPresignResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Upload URL created" },
          data: {
            type: "object",
            properties: {
              objectKey: { type: "string" },
              uploadUrl: { type: "string" },
              fileUrl: { type: "string" },
              expiresIn: { type: "integer", example: 300 },
            },
          },
          meta: { nullable: true, type: "object" },
          error: { nullable: true, type: "object" },
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
