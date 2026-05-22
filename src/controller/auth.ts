import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcrypt";
import {
  Action,
  EmployeeStatus,
  MenuCode,
  PlatformPermission,
} from "../generated/prisma/enums";
import {
  type AuthTokenPayload,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/token";

type AuthClientType = "admin" | "mobile";

const ADMIN_MENUS = new Set<MenuCode>([
  MenuCode.DASHBOARD,
  MenuCode.EMPLOYEE,
  MenuCode.DEPARTMENT,
  MenuCode.POSITION,
  MenuCode.ORGANIZATION,
  MenuCode.PLAN_MANAGEMENT,
  MenuCode.DESIGNATION,
  MenuCode.PAYROLL,
]);

const MOBILE_ALLOWED_STATUSES = new Set<EmployeeStatus>([
  EmployeeStatus.ACTIVE,
  EmployeeStatus.ON_LEAVE,
  EmployeeStatus.ON_PROBATION,
]);

const SUPERADMIN_REQUIRED_PERMISSIONS = new Set<PlatformPermission>([
  PlatformPermission.APPROVAL_VIEW,
  PlatformPermission.APPROVAL_DECIDE,
]);

type MenuPermission = {
  menu: { menu: MenuCode };
  actions: Action[];
};

const getEmployeeAuthProfileById = async (id: number) =>
  prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      full_name: true,
      code: true,
      email: true,
      phoneNumber: true,
      avatar: true,
      organizationId: true,
      status: true,
      employment_type: true,
      organization: {
        select: {
          id: true,
          code: true,
          name: true,
          plan: {
            select: {
              menuPermission: {
                select: {
                  actions: true,
                  menu: {
                    select: { menu: true },
                  },
                },
              },
            },
          },
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      positions: {
        select: {
          assigned_at: true,
          position: true,
        },
      },
      designations: {
        select: {
          designation: {
            select: {
              id: true,
              name: true,
              menuPermission: {
                select: {
                  actions: true,
                  menu: {
                    select: { menu: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

const getPlatformUserAuthProfileById = async (id: number) =>
  prisma.platformUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      isActive: true,
      permissions: true,
    },
  });

const getPlatformUserAuthIdentityByEmail = async (email: string) =>
  prisma.platformUser.findUnique({
    where: { email },
    select: {
      id: true,
      password: true,
    },
  });

const hasAnyAction = (actions: Action[]) => actions.length > 0;

const extractDesignationPermissions = (
  employee: NonNullable<Awaited<ReturnType<typeof getEmployeeAuthProfileById>>>,
) =>
  employee.designations.flatMap((item) => item.designation.menuPermission as MenuPermission[]);

const hasAdminAccess = (employee: Awaited<ReturnType<typeof getEmployeeAuthProfileById>>) => {
  if (!employee) return false;

  // Admin access should come from user-level role assignment, not org plan defaults.
  const designationPermissions = extractDesignationPermissions(employee).filter((entry) =>
    ADMIN_MENUS.has(entry.menu.menu),
  );
  return designationPermissions.some((entry) => hasAnyAction(entry.actions));
};

const canUseMobile = (employee: Awaited<ReturnType<typeof getEmployeeAuthProfileById>>) => {
  if (!employee) return false;
  return MOBILE_ALLOWED_STATUSES.has(employee.status);
};

const hasSuperadminAccess = (
  platformUser: Awaited<ReturnType<typeof getPlatformUserAuthProfileById>>,
) => {
  if (!platformUser || !platformUser.isActive) return false;
  return platformUser.permissions.some((permission) =>
    SUPERADMIN_REQUIRED_PERMISSIONS.has(permission),
  );
};

const buildAuthPayload = (
  employee: NonNullable<Awaited<ReturnType<typeof getEmployeeAuthProfileById>>>,
  clientType: AuthClientType,
): AuthTokenPayload => ({
  sub: employee.id,
  orgId: employee.organizationId,
  email: employee.email,
  clientType,
  actorType: "employee",
  ...(clientType === "admin" ? { adminScope: "OWN_ADMIN" as const } : {}),
});

const buildSuperadminPayload = (
  platformUser: NonNullable<Awaited<ReturnType<typeof getPlatformUserAuthProfileById>>>,
): AuthTokenPayload => ({
  sub: platformUser.id,
  orgId: 0,
  email: platformUser.email,
  clientType: "admin",
  adminScope: "SUPERADMIN",
  actorType: "platform",
});

const uniqueActions = (actions: Action[]) => Array.from(new Set(actions));

const buildAdminPermissionSummary = (
  employee: NonNullable<Awaited<ReturnType<typeof getEmployeeAuthProfileById>>>,
) => {
  const permissionMap = new Map<MenuCode, Set<Action>>();
  for (const entry of extractDesignationPermissions(employee)) {
    const current = permissionMap.get(entry.menu.menu) ?? new Set<Action>();
    for (const action of entry.actions) {
      current.add(action);
    }
    permissionMap.set(entry.menu.menu, current);
  }

  return Array.from(permissionMap.entries()).map(([menu, actions]) => ({
    menu,
    actions: uniqueActions(Array.from(actions)),
  }));
};

const buildAuthResponse = (
  employee: NonNullable<Awaited<ReturnType<typeof getEmployeeAuthProfileById>>>,
  clientType: AuthClientType,
) => ({
  id: employee.id,
  full_name: employee.full_name,
  code: employee.code,
  email: employee.email,
  phoneNumber: employee.phoneNumber,
  avatar: employee.avatar,
  status: employee.status,
  employment_type: employee.employment_type,
  organization: {
    id: employee.organization.id,
    code: employee.organization.code,
    name: employee.organization.name,
  },
  department: employee.department,
  positions: employee.positions.map((row) => ({
    assigned_at: row.assigned_at,
    position: row.position,
  })),
  designations: employee.designations.map((row) => ({
    id: row.designation.id,
    name: row.designation.name,
  })),
  permissions: clientType === "admin" ? buildAdminPermissionSummary(employee) : [],
  scope: clientType === "admin" ? "OWN_ADMIN" : null,
});

const buildSuperadminAuthResponse = (
  platformUser: NonNullable<Awaited<ReturnType<typeof getPlatformUserAuthProfileById>>>,
) => ({
  id: platformUser.id,
  email: platformUser.email,
  fullName: platformUser.fullName,
  isActive: platformUser.isActive,
  permissions: platformUser.permissions,
  scope: "SUPERADMIN",
});

const signTokenPair = (payload: AuthTokenPayload) => ({
  accessToken: signAccessToken(payload),
  refreshToken: signRefreshToken(payload),
});

const ensurePasswordMatch = async (password: string, hashedPassword: string | null) => {
  if (!hashedPassword) return false;
  return bcrypt.compare(password, hashedPassword);
};

export const adminLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const [platformAuthIdentity, employeeAuthIdentity] = await Promise.all([
    getPlatformUserAuthIdentityByEmail(email),
    prisma.employee.findFirst({
      where: { email },
      select: {
        id: true,
        password: true,
      },
    }),
  ]);

  if (platformAuthIdentity) {
    const platformPasswordMatched = await ensurePasswordMatch(
      password,
      platformAuthIdentity.password,
    );
    if (platformPasswordMatched) {
      const platformUser = await getPlatformUserAuthProfileById(platformAuthIdentity.id);
      if (!platformUser) {
        return res.status(404).json({ message: "Superadmin account not found" });
      }
      if (!hasSuperadminAccess(platformUser)) {
        return res.status(403).json({ message: "Superadmin access is required" });
      }

      const payload = buildSuperadminPayload(platformUser);
      const tokens = signTokenPair(payload);
      return res.status(200).json({
        message: "Admin login successful",
        data: buildSuperadminAuthResponse(platformUser),
        tokens,
      });
    }
  }

  if (!employeeAuthIdentity) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const passwordMatched = await ensurePasswordMatch(
    password,
    employeeAuthIdentity.password ?? null,
  );
  if (!passwordMatched) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const employee = await getEmployeeAuthProfileById(employeeAuthIdentity.id);
  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
  }
  if (!hasAdminAccess(employee)) {
    return res.status(403).json({ message: "Admin access is required" });
  }

  const payload = buildAuthPayload(employee, "admin");
  const tokens = signTokenPair(payload);
  return res.status(200).json({
    message: "Admin login successful",
    data: buildAuthResponse(employee, "admin"),
    tokens,
  });
};

export const mobileLogin = async (req: Request, res: Response) => {
  const { identifier, password } = req.body as {
    identifier?: string;
    password?: string;
  };

  if (!identifier || !password) {
    return res.status(400).json({ message: "Identifier and password are required" });
  }

  const authIdentity = await prisma.employee.findFirst({
    where: {
      OR: [{ email: identifier }, { code: identifier }, { phoneNumber: identifier }],
    },
    select: {
      id: true,
      password: true,
    },
  });

  if (!authIdentity) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const passwordMatched = await ensurePasswordMatch(password, authIdentity.password ?? null);
  if (!passwordMatched) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const employee = await getEmployeeAuthProfileById(authIdentity.id);
  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
  }

  if (!canUseMobile(employee)) {
    return res.status(403).json({ message: "Employee is not allowed to use mobile app" });
  }

  const payload = buildAuthPayload(employee, "mobile");
  const tokens = signTokenPair(payload);
  return res.status(200).json({
    message: "Mobile login successful",
    data: buildAuthResponse(employee, "mobile"),
    tokens,
  });
};

const refreshByClientType =
  (clientType: AuthClientType) => async (req: Request, res: Response) => {
    try {
      const token =
        (req.body && req.body.refreshToken) ||
        (req.query && (req.query.refreshToken as string | undefined));

      if (!token) {
        return res.status(400).json({ message: "Refresh token is required" });
      }

      let payload: AuthTokenPayload;
      try {
        payload = verifyRefreshToken(token);
      } catch {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }

      if (payload.clientType !== clientType) {
        return res.status(403).json({
          message: `This refresh token is not valid for ${clientType} auth flow`,
        });
      }

      if (clientType === "admin" && payload.adminScope === "SUPERADMIN") {
        const platformUser = await getPlatformUserAuthProfileById(payload.sub);
        if (!platformUser) {
          return res.status(404).json({ message: "Superadmin account not found" });
        }
        if (!hasSuperadminAccess(platformUser)) {
          return res.status(403).json({ message: "Superadmin access is required" });
        }

        const nextPayload = buildSuperadminPayload(platformUser);
        const tokens = signTokenPair(nextPayload);
        return res.status(200).json({
          message: "Token refreshed",
          data: buildSuperadminAuthResponse(platformUser),
          tokens,
        });
      }

      const employee = await getEmployeeAuthProfileById(payload.sub);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      if (clientType === "admin" && !hasAdminAccess(employee)) {
        return res.status(403).json({ message: "Admin access is required" });
      }

      if (clientType === "mobile" && !canUseMobile(employee)) {
        return res.status(403).json({ message: "Employee is not allowed to use mobile app" });
      }

      const newPayload = buildAuthPayload(employee, clientType);
      const tokens = signTokenPair(newPayload);
      return res.status(200).json({
        message: "Token refreshed",
        data: buildAuthResponse(employee, clientType),
        tokens,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to refresh token" });
    }
  };

export const adminRefresh = refreshByClientType("admin");
export const mobileRefresh = refreshByClientType("mobile");
