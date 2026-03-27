import { prisma } from "../prisma.js";

const STATION_ASSIGN_PREFIX = "STATION_ASSIGN:";

export const extractAssignedStationIds = (user) => {
  const fromPermissions = (user?.permissions || [])
    .filter((p) => typeof p === "string" && p.startsWith(STATION_ASSIGN_PREFIX))
    .map((p) => p.replace(STATION_ASSIGN_PREFIX, "").trim())
    .filter(Boolean);

  const ids = new Set(fromPermissions);
  if (user?.assignedStationId) ids.add(String(user.assignedStationId));
  return Array.from(ids);
};

export const buildUserScope = async (authUser) => {
  if (!authUser?.userId) {
    return { role: null, assignedVehicleId: null, assignedStationIds: [], allowedVehicleIds: [] };
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: {
      role: true,
      roles: true,
      assignedVehicleId: true,
      assignedStationId: true,
      permissions: true,
    },
  });

  if (!user) {
    return { role: null, assignedVehicleId: null, assignedStationIds: [], allowedVehicleIds: [] };
  }

  const assignedStationIds = extractAssignedStationIds(user);
  const allRoles = Array.from(new Set([user.role, ...(Array.isArray(user.roles) ? user.roles : [])].filter(Boolean)));
  const hasRole = (role) => allRoles.includes(role);
  const scopeRolePriority = [
    "SUPER_ADMIN",
    "FLEET_MANAGER",
    "FUEL_MANAGER",
    "VEHICLE_MANAGER",
    "STATION_MANAGER",
    "DRIVER",
    "VIEWER",
  ];
  const effectiveRole = scopeRolePriority.find((r) => hasRole(r)) || user.role;
  let allowedVehicleIds = [];

  if (hasRole("STATION_MANAGER") && assignedStationIds.length) {
    const links = await prisma.fuelDispense.findMany({
      where: { stationId: { in: assignedStationIds } },
      select: { vehicleId: true },
      distinct: ["vehicleId"],
    });
    allowedVehicleIds = links.map((x) => x.vehicleId).filter(Boolean);
  }

  if (hasRole("DRIVER") && user.assignedVehicleId) {
    allowedVehicleIds = [user.assignedVehicleId];
  }

  return {
    role: effectiveRole,
    roles: allRoles,
    assignedVehicleId: user.assignedVehicleId || null,
    assignedStationIds,
    allowedVehicleIds,
  };
};

export const asStationPermissions = (stationIds = []) =>
  Array.from(new Set((stationIds || []).filter(Boolean))).map((id) => `${STATION_ASSIGN_PREFIX}${id}`);
