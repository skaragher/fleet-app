import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, inspectionSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";
import { z } from "zod";
import { buildUserScope } from "../utils/userScope.js";

const router = Router();

const isSuccessLocked = (inspection) => {
  if (!inspection || inspection.result !== "SUCCES") return false;
  const reference = inspection.doneAt || inspection.updatedAt || inspection.createdAt;
  if (!reference) return true;
  const hours = (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60);
  return hours > 24;
};

const getInspectionOngoingUntil = (inspection, now = new Date()) => {
  if (!inspection) return null;
  const refNow = new Date(now);

  if (inspection.nextInspect) {
    const next = new Date(inspection.nextInspect);
    if (!Number.isNaN(next.getTime()) && next > refNow) return next;
  }

  // Une visite planifiée sans résultat est considérée en cours jusqu'à sa date prévue.
  if (!inspection.result && inspection.scheduledAt) {
    const scheduled = new Date(inspection.scheduledAt);
    if (!Number.isNaN(scheduled.getTime()) && scheduled > refNow) return scheduled;
  }

  return null;
};

const daysUntil = (date, now = new Date()) => {
  if (!date) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

router.get("/", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const where = {};
    if (scope.role === "DRIVER") {
      where.vehicleId = scope.assignedVehicleId || "__none__";
    } else if (scope.role === "STATION_MANAGER") {
      where.vehicleId = { in: scope.allowedVehicleIds.length ? scope.allowedVehicleIds : ["__none__"] };
    }

    const items = await prisma.inspection.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (e) { next(e); }
});

router.get("/:id", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const item = await prisma.inspection.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ message: "Inspection not found" });
    if (scope.role === "DRIVER" && item.vehicleId !== scope.assignedVehicleId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (scope.role === "STATION_MANAGER" && !scope.allowedVehicleIds.includes(item.vehicleId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(item);
  } catch (e) { next(e); }
});

router.post("/", auth(["SUPER_ADMIN", "FLEET_MANAGER", "VEHICLE_MANAGER", "STATION_MANAGER", "DRIVER"]), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const data = parse(inspectionSchema, req.body);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle || vehicle.status !== "EN_SERVICE") {
      return res.status(400).json({ message: "Opération impossible : le véhicule doit être EN_SERVICE." });
    }

    const existingInspections = await prisma.inspection.findMany({
      where: { vehicleId: data.vehicleId },
      select: { id: true, result: true, scheduledAt: true, nextInspect: true },
      orderBy: { createdAt: "desc" }
    });

    const now = new Date();
    const blocking = existingInspections.find((inspection) => {
      const ongoingUntil = getInspectionOngoingUntil(inspection, now);
      const remaining = daysUntil(ongoingUntil, now);
      return remaining !== null && remaining > 30;
    });

    if (blocking) {
      const blockingUntil = getInspectionOngoingUntil(blocking, now);
      const remaining = daysUntil(blockingUntil, now);
      return res.status(400).json({
        message: `Impossible de saisir une nouvelle visite: une visite en cours reste valide ${remaining} jour(s).`
      });
    }

    if (scope.role === "DRIVER" && data.vehicleId !== scope.assignedVehicleId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const item = await prisma.inspection.create({ data });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

router.put("/:id", auth(["SUPER_ADMIN", "FLEET_MANAGER", "VEHICLE_MANAGER", "STATION_MANAGER", "DRIVER"]), async (req, res, next) => {
  try {
    const data = parse(inspectionSchema.partial(), req.body);
    const existing = await prisma.inspection.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Inspection not found" });
    const targetVehicleId = data.vehicleId || existing.vehicleId;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: targetVehicleId } });
    if (!vehicle || vehicle.status !== "EN_SERVICE") {
      return res.status(400).json({ message: "Opération impossible : le véhicule doit être EN_SERVICE." });
    }
    if (isSuccessLocked(existing)) {
      return res.status(403).json({ message: "Inspection SUCCES verrouillee apres 24h" });
    }
    const item = await prisma.inspection.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (e) { next(e); }
});

const validateInspectionSchema = z.object({
  result: z.enum(["SUCCES", "ECHEC"]),
  doneAt: z.string().datetime().optional(),
  nextInspect: z.coerce.date().optional().nullable(),
  cost: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.patch("/:id/validate", auth(["SUPER_ADMIN", "FLEET_MANAGER", "VEHICLE_MANAGER", "STATION_MANAGER", "DRIVER"]), async (req, res, next) => {
  try {
    const payload = parse(validateInspectionSchema, req.body);
    const existing = await prisma.inspection.findUnique({ where: { id: req.params.id } });

    if (!existing) {
      return res.status(404).json({ message: "Inspection not found" });
    }

    if (existing.result) {
      return res.status(409).json({ message: "Inspection already validated" });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: existing.vehicleId } });
    if (!vehicle || vehicle.status !== "EN_SERVICE") {
      return res.status(400).json({ message: "Opération impossible : le véhicule doit être EN_SERVICE." });
    }

    const data = {
      result: payload.result,
      doneAt: payload.doneAt ? new Date(payload.doneAt) : new Date(),
      nextInspect: payload.nextInspect ?? existing.nextInspect,
      cost: payload.cost ?? existing.cost,
      notes: payload.notes ?? existing.notes,
    };

    const item = await prisma.inspection.update({
      where: { id: req.params.id },
      data,
    });

    res.json(item);
  } catch (e) { next(e); }
});

router.delete("/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const existing = await prisma.inspection.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Inspection not found" });
    if (isSuccessLocked(existing)) {
      return res.status(403).json({ message: "Inspection SUCCES verrouillee apres 24h" });
    }
    await prisma.inspection.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.use(errorHandler);
export default router;
