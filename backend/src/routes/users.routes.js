import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { asStationPermissions, extractAssignedStationIds } from "../utils/userScope.js";

const router = Router();

const MANAGE_ROLES = ["SUPER_ADMIN"];

const sanitizeUser = (u) => {
  if (!u) return null;
  const { password, ...rest } = u;
  return {
    ...rest,
    assignedStationIds: extractAssignedStationIds(rest),
  };
};

router.get("/", auth(MANAGE_ROLES), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
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

router.post("/", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role = "VIEWER",
      permissions = [],
      assignedVehicleId = null,
      assignedStationId = null,
      assignedStationIds = [],
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email et password sont requis" });
    }

    const hashed = await bcrypt.hash(String(password), 10);
    const stationPermissions = asStationPermissions(assignedStationIds);
    const mergedPermissions = Array.from(new Set([...(permissions || []), ...stationPermissions]));

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        password: hashed,
        role,
        permissions: mergedPermissions,
        assignedVehicleId: assignedVehicleId || null,
        assignedStationId: assignedStationId || assignedStationIds?.[0] || null,
      },
      include: {
        assignedVehicle: { select: { id: true, plate: true, model: true } },
        assignedStation: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(sanitizeUser(user));
  } catch (e) {
    next(e);
  }
});

router.put("/:id", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    const id = req.params.id;
    const {
      name,
      email,
      password,
      role,
      permissions,
      assignedVehicleId,
      assignedStationId,
      assignedStationIds,
    } = req.body || {};

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: "Utilisateur introuvable" });

    const nextPermissionsBase = Array.isArray(permissions) ? permissions : current.permissions || [];
    const stationPermissions = asStationPermissions(assignedStationIds || extractAssignedStationIds(current));
    const cleaned = nextPermissionsBase.filter((p) => !String(p).startsWith("STATION_ASSIGN:"));
    const mergedPermissions = Array.from(new Set([...cleaned, ...stationPermissions]));

    const data = {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(email !== undefined ? { email: String(email).trim().toLowerCase() } : {}),
      ...(role !== undefined ? { role } : {}),
      permissions: mergedPermissions,
      ...(assignedVehicleId !== undefined ? { assignedVehicleId: assignedVehicleId || null } : {}),
      ...(assignedStationId !== undefined || assignedStationIds !== undefined
        ? { assignedStationId: assignedStationId || assignedStationIds?.[0] || null }
        : {}),
    };

    if (password) {
      data.password = await bcrypt.hash(String(password), 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: {
        assignedVehicle: { select: { id: true, plate: true, model: true } },
        assignedStation: { select: { id: true, name: true } },
      },
    });

    res.json(sanitizeUser(user));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
