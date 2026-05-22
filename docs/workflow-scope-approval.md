# Scope-Based Auth and Approval Workflow

This document explains the current workflow implementation for:

- admin/mobile authentication scopes
- superadmin (platform) access model
- org-level and platform-level approval stages
- permission and route boundaries

## 1) Core Identity Model

The system uses two identity stores:

- `Employee` (organization-bound users)
  - Used for normal org users and org admins.
  - Admin scope from this model is `OWN_ADMIN`.
- `PlatformUser` (platform-level users)
  - Used for cross-organization superadmin capability.
  - Admin scope from this model is `SUPERADMIN`.

## 2) Auth Scope Model

### Admin login route

- `POST /api/auth/admin/login`

This single admin route issues one of two scopes:

- `OWN_ADMIN` when login resolves to `Employee`
- `SUPERADMIN` when login resolves to `PlatformUser`

### Mobile login route

- `POST /api/auth/mobile/login`

Mobile login remains org employee only and does not use admin scope.

### Token claims (important)

Admin tokens now carry:

- `clientType: "admin"`
- `adminScope: "OWN_ADMIN" | "SUPERADMIN"` (admin only)
- `actorType: "employee" | "platform"`

Mobile tokens carry:

- `clientType: "mobile"`

## 3) Approval Workflow Model

Approval requests use multi-stage steps in `ApprovalStep` with:

- `scope: ORG | PLATFORM`
- `approverId` for org actor steps
- `platformApproverId` for platform actor steps

### Stage generation

When creating escalated approval types (currently overtime/payroll adjustment):

1. org approver steps are created as `scope=ORG`
2. final platform step is created as `scope=PLATFORM`

### Decision rules

- If current step is `ORG`:
  - only org approver can decide.
- If current step is `PLATFORM`:
  - only `SUPERADMIN` actor with matching `platformApproverId` can decide.

This is enforced in `src/controller/approval.ts`.

## 4) Route Boundary Rules

### Org-admin-only endpoints

Many admin management endpoints use `requireOwnAdminScope`, so `SUPERADMIN` is blocked there.

Examples:

- employees, departments, positions
- organization
- uploads
- leave admin management
- payroll admin management

### Shared admin endpoint (OWN_ADMIN + SUPERADMIN)

- plan management (`/api/admin/plan`) is intentionally shared.
- `OWN_ADMIN` passes via org permission checks.
- `SUPERADMIN` passes with platform permission checks.

### Superadmin-specific management

Platform user management endpoints:

- `GET /api/admin/platform-users`
- `POST /api/admin/platform-users`
- `PATCH /api/admin/platform-users/:id`
- `DELETE /api/admin/platform-users/:id`

These require platform permissions and SUPERADMIN scope.

## 5) Permission Model Summary

### Org permissions

Org users/admins use existing `requirePermission(menu, action)` logic
based on plan + designation permissions.

### Platform permissions

Platform users use `PlatformPermission[]`:

- `APPROVAL_VIEW`
- `APPROVAL_DECIDE`

Used for:

- platform approval stage access
- platform user CRUD
- superadmin access to shared admin flows where enabled (e.g. plan management)

## 6) Audit Logging

Audit logs include additional context for cross-org actions:

- `actorType` (`ORG_USER` or `SUPERADMIN`)
- `targetOrganizationId` for platform actions on org-owned resources

This allows clear traceability for cross-tenant approvals.

## 7) Seeder Defaults

Seed script creates a platform superadmin account:

- email: `superadmin@gmail.com`
- password: `123456`

This account is stored in `PlatformUser`, not `Employee`.

## 8) Practical Frontend Notes

- Admin app only needs `POST /api/auth/admin/login`.
- Read `data.scope` in login response:
  - `OWN_ADMIN` => standard org admin UI/actions
  - `SUPERADMIN` => platform-level UI/actions
- For admin refresh use:
  - `POST /api/auth/admin/refresh`

No separate superadmin login route is required.
