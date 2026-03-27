import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { asStationPermissions, extractAssignedStationIds } from "../utils/userScope.js";

const router = Router();

const MANAGE_ROLES = ["SUPER_ADMIN", "FLEET_MANAGER"];
const USER_ROLE_VALUES = ["SUPER_ADMIN", "FLEET_MANAGER", "FUEL_MANAGER", "STATION_MANAGER", "VEHICLE_MANAGER", "DRIVER", "VIEWER"];
const normalizeLicenseNo = (value) => String(value || "").trim().toUpperCase();
const normalizeRole = (value, fallback = "VIEWER") => {
  const role = String(value || fallback).trim().toUpperCase();
  return USER_ROLE_VALUES.includes(role) ? role : fallback;
};
const normalizeAdditionalRoles = (roles = [], primaryRole = "VIEWER") => {
  const primary = normalizeRole(primaryRole, "VIEWER");
  const unique = Array.from(new Set((Array.isArray(roles) ? roles : []).map((r) => normalizeRole(r, "")).filter(Boolean)));
  return unique.filter((r) => r !== primary);
};

const findDriverByVehicle = async (vehicleId, excludeUserId = null) => {
  if (!vehicleId) return null;
  return prisma.user.findFirst({
    where: {
      OR: [{ role: "DRIVER" }, { roles: { has: "DRIVER" } }],
      assignedVehicleId: String(vehicleId),
      ...(excludeUserId ? { id: { not: String(excludeUserId) } } : {}),
    },
    select: { id: true, name: true, email: true },
  });
};

const findUserByLicenseNo = async (licenseNo, excludeUserId = null) => {
  if (!licenseNo) return null;
  return prisma.user.findFirst({
    where: {
      licenseNo: { equals: String(licenseNo), mode: "insensitive" },
      ...(excludeUserId ? { id: { not: String(excludeUserId) } } : {}),
    },
    select: { id: true, name: true, email: true, licenseNo: true },
  });
};

const syncUserVehicleHistory = async ({
  tx,
  userId,
  previousVehicleId,
  nextVehicleId,
  assignedById = null,
}) => {
  const prev = previousVehicleId || null;
  const next = nextVehicleId || null;
  if (prev === next) {
    if (!next) return;
    const active = await tx.userVehicleAssignment.findFirst({
      where: { userId, unassignedAt: null },
      select: { id: true },
    });
    if (!active) {
      const snapshotUser = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      await tx.userVehicleAssignment.create({
        data: {
          userId,
          vehicleId: next,
          assignedById: assignedById || null,
          userName: snapshotUser?.name || null,
          userEmail: snapshotUser?.email || null,
        },
      });
    }
    return;
  }

  await tx.userVehicleAssignment.updateMany({
    where: { userId, unassignedAt: null },
    data: { unassignedAt: new Date() },
  });

  if (next) {
    const snapshotUser = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    await tx.userVehicleAssignment.create({
      data: {
        userId,
        vehicleId: next,
        assignedById: assignedById || null,
        userName: snapshotUser?.name || null,
        userEmail: snapshotUser?.email || null,
      },
    });
  }
};

const sanitizeUser = (u) => {
  if (!u) return null;
  const { password, ...rest } = u;
  const extraRoles = Array.isArray(rest.roles) ? rest.roles : [];
  return {
    ...rest,
    roles: extraRoles,
    allRoles: Array.from(new Set([rest.role, ...extraRoles].filter(Boolean))),
    assignedStationIds: extractAssignedStationIds(rest),
  };
};

router.get("/", auth(MANAGE_ROLES), async (_req, res, next) => {
  try {
    const isFleetManager = _req.user?.role === "FLEET_MANAGER";
    const users = await prisma.user.findMany({
      where: isFleetManager ? { OR: [{ role: "DRIVER" }, { roles: { has: "DRIVER" } }] } : {},
      include: {
        assignedVehicle: { select: { id: true, plate: true, model: true } },
        assignedStation: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(users.map(sanitizeUser));
  } catch (e) {
    next(e);
  }
});

router.get("/:id/vehicle-history", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    const isFleetManager = req.user?.role === "FLEET_MANAGER";
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true },
    });
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    if (isFleetManager && String(user.role || "").toUpperCase() !== "DRIVER") {
      return res.status(403).json({ message: "Le gestionnaire flotte ne peut consulter que les chauffeurs." });
    }

    const history = await prisma.userVehicleAssignment.findMany({
      where: { userId: req.params.id },
      include: {
        vehicle: { select: { id: true, plate: true, model: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { assignedAt: "desc" },
    });
    res.json(history);
  } catch (e) {
    next(e);
  }
});

router.post("/", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    const isFleetManager = req.user?.role === "FLEET_MANAGER";
    const {
      name,
      email,
      licenseNo,
      password,
      role = "VIEWER",
      roles = [],
      isActive = true,
      permissions = [],
      assignedVehicleId = null,
      assignedStationId = null,
      assignedStationIds = [],
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email et password sont requis" });
    }

    if (isFleetManager && String(role || "").toUpperCase() !== "DRIVER") {
      return res.status(403).json({ message: "Le gestionnaire flotte ne peut créer que des chauffeurs." });
    }

    const isSuperAdmin = req.user?.role === "SUPER_ADMIN";
    const effectiveRole = isFleetManager ? "DRIVER" : normalizeRole(role, "VIEWER");
    if (!isSuperAdmin && Array.isArray(roles) && roles.length) {
      return res.status(403).json({ message: "Seul SUPER_ADMIN peut attribuer plusieurs rôles." });
    }
    const effectiveRoles = isSuperAdmin ? normalizeAdditionalRoles(roles, effectiveRole) : [];
    const effectiveIsActive = Boolean(isActive);
    if (!effectiveIsActive && effectiveRole === "DRIVER" && assignedVehicleId) {
      return res.status(400).json({
        message: "Un chauffeur désactivé doit d'abord être désaffecté de son véhicule.",
      });
    }
    if (effectiveRole === "DRIVER" && assignedVehicleId) {
      const alreadyAssigned = await findDriverByVehicle(assignedVehicleId);
      if (alreadyAssigned) {
        return res.status(409).json({
          message: "Ce véhicule est déjà affecté à un autre chauffeur.",
        });
      }
    }
    const effectiveAllRoles = Array.from(new Set([effectiveRole, ...effectiveRoles].filter(Boolean)));
    const hasDriverRole = effectiveAllRoles.includes("DRIVER");
    const cleanLicenseNo = normalizeLicenseNo(licenseNo);
    if (hasDriverRole && !cleanLicenseNo) {
      return res.status(400).json({ message: "Le numéro de permis est requis pour un chauffeur." });
    }
    if (hasDriverRole && cleanLicenseNo) {
      const existingLicense = await findUserByLicenseNo(cleanLicenseNo);
      if (existingLicense) {
        return res.status(409).json({ message: "Ce numéro de permis est déjà utilisé." });
      }
    }

    const hashed = await bcrypt.hash(String(password), 10);
    const stationPermissions = asStationPermissions(assignedStationIds);
    const mergedPermissions = Array.from(new Set([...(permissions || []), ...stationPermissions]));

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: String(name).trim(),
          email: String(email).trim().toLowerCase(),
          licenseNo: hasDriverRole ? cleanLicenseNo : null,
          password: hashed,
          role: effectiveRole,
          roles: effectiveRoles,
          isActive: effectiveIsActive,
          deactivatedAt: effectiveIsActive ? null : new Date(),
          permissions: isFleetManager ? [] : mergedPermissions,
          assignedVehicleId: assignedVehicleId || null,
          assignedStationId: isFleetManager ? null : (assignedStationId || assignedStationIds?.[0] || null),
        },
        include: {
          assignedVehicle: { select: { id: true, plate: true, model: true } },
          assignedStation: { select: { id: true, name: true } },
        },
      });

      if (effectiveRole === "DRIVER" && assignedVehicleId) {
        await syncUserVehicleHistory({
          tx,
          userId: created.id,
          previousVehicleId: null,
          nextVehicleId: assignedVehicleId,
          assignedById: req.user?.id || null,
        });
      }

      return created;
    });

    res.status(201).json(sanitizeUser(user));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    const isFleetManager = req.user?.role === "FLEET_MANAGER";
    const id = req.params.id;
    const {
      name,
      email,
      licenseNo,
      password,
      role,
      roles,
      isActive,
      permissions,
      assignedVehicleId,
      assignedStationId,
      assignedStationIds,
    } = req.body || {};

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Utilisateur introuvable" });

    const currentAllRoles = Array.from(new Set([current.role, ...(current.roles || [])].filter(Boolean)));
    if (isFleetManager && !currentAllRoles.includes("DRIVER")) {
      return res.status(403).json({ message: "Le gestionnaire flotte ne peut modifier que des chauffeurs." });
    }

    if (isFleetManager && role !== undefined && String(role || "").toUpperCase() !== "DRIVER") {
      return res.status(403).json({ message: "Le gestionnaire flotte ne peut définir que le rôle DRIVER." });
    }

    const isSuperAdmin = req.user?.role === "SUPER_ADMIN";
    const nextRole = role !== undefined ? normalizeRole(role, "VIEWER") : normalizeRole(current.role, "VIEWER");
    const effectiveRole = isFleetManager ? "DRIVER" : nextRole;
    if (!isSuperAdmin && roles !== undefined) {
      return res.status(403).json({ message: "Seul SUPER_ADMIN peut modifier les rôles additionnels." });
    }
    const nextRoles = roles !== undefined
      ? normalizeAdditionalRoles(roles, effectiveRole)
      : normalizeAdditionalRoles(current.roles || [], effectiveRole);
    const nextIsActive = isActive !== undefined ? Boolean(isActive) : current.isActive !== false;
    const nextAssignedVehicleId = assignedVehicleId !== undefined ? assignedVehicleId : current.assignedVehicleId;
    if (!nextIsActive && effectiveRole === "DRIVER" && nextAssignedVehicleId) {
      return res.status(400).json({
        message: "Retirez d'abord le véhicule avant de désactiver ce chauffeur.",
      });
    }
    if (effectiveRole === "DRIVER" && nextAssignedVehicleId) {
      const alreadyAssigned = await findDriverByVehicle(nextAssignedVehicleId, id);
      if (alreadyAssigned) {
        return res.status(409).json({
          message: "Ce véhicule est déjà affecté à un autre chauffeur.",
        });
      }
    }
    const effectiveAllRoles = Array.from(new Set([effectiveRole, ...nextRoles].filter(Boolean)));
    const hasDriverRole = effectiveAllRoles.includes("DRIVER");
    const currentLicenseNo = normalizeLicenseNo(current.licenseNo);
    const nextLicenseNo = licenseNo !== undefined ? normalizeLicenseNo(licenseNo) : currentLicenseNo;
    if (hasDriverRole && !nextLicenseNo) {
      return res.status(400).json({ message: "Le numéro de permis est requis pour un chauffeur." });
    }
    if (hasDriverRole && nextLicenseNo) {
      const existingLicense = await findUserByLicenseNo(nextLicenseNo, id);
      if (existingLicense) {
        return res.status(409).json({ message: "Ce numéro de permis est déjà utilisé." });
      }
    }

    const nextPermissionsBase = Array.isArray(permissions) ? permissions : current.permissions || [];
    const stationPermissions = asStationPermissions(assignedStationIds || extractAssignedStationIds(current));
    const cleaned = nextPermissionsBase.filter((p) => !String(p).startsWith("STATION_ASSIGN:"));
    const mergedPermissions = Array.from(new Set([...cleaned, ...stationPermissions]));

    const data = {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(email !== undefined ? { email: String(email).trim().toLowerCase() } : {}),
      ...(licenseNo !== undefined || role !== undefined || roles !== undefined
        ? { licenseNo: hasDriverRole ? nextLicenseNo : null }
        : {}),
      ...(role !== undefined ? { role: effectiveRole } : {}),
      ...(roles !== undefined || role !== undefined
        ? { roles: isSuperAdmin ? nextRoles : (current.roles || []) }
        : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive), deactivatedAt: Boolean(isActive) ? null : new Date() } : {}),
      permissions: isFleetManager ? (current.permissions || []) : mergedPermissions,
      ...(assignedVehicleId !== undefined ? { assignedVehicleId: assignedVehicleId || null } : {}),
      ...(assignedStationId !== undefined || assignedStationIds !== undefined
        ? { assignedStationId: isFleetManager ? null : (assignedStationId || assignedStationIds?.[0] || null) }
        : {}),
    };

    if (password) {
      data.password = await bcrypt.hash(String(password), 10);
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data,
        include: {
          assignedVehicle: { select: { id: true, plate: true, model: true } },
          assignedStation: { select: { id: true, name: true } },
        },
      });

      const previousVehicleId = current.assignedVehicleId || null;
      const historyTargetVehicleId = effectiveRole === "DRIVER" ? (nextAssignedVehicleId || null) : null;
      await syncUserVehicleHistory({
        tx,
        userId: id,
        previousVehicleId,
        nextVehicleId: historyTargetVehicleId,
        assignedById: req.user?.id || null,
      });

      return updated;
    });

    res.json(sanitizeUser(user));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    const isFleetManager = req.user?.role === "FLEET_MANAGER";
    if (isFleetManager) {
      const current = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!current) return res.status(404).json({ message: "Utilisateur introuvable" });
      const currentAllRoles = Array.from(new Set([current.role, ...(current.roles || [])].filter(Boolean)));
      if (!currentAllRoles.includes("DRIVER")) {
        return res.status(403).json({ message: "Le gestionnaire flotte ne peut supprimer que des chauffeurs." });
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.userVehicleAssignment.updateMany({
        where: { userId: req.params.id, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      await tx.user.delete({ where: { id: req.params.id } });
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
