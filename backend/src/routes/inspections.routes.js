import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, inspectionSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";
import { z } from "zod";

const router = Router();

const isSuccessLocked = (inspection) => {
  if (!inspection || inspection.result !== "SUCCES") return false;
  const reference = inspection.doneAt || inspection.updatedAt || inspection.createdAt;
  if (!reference) return true;
  const hours = (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60);
  return hours > 24;
};

router.get("/", auth(), async (_req, res, next) => {
  try {
    const items = await prisma.inspection.findMany({ orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (e) { next(e); }
});

router.get("/:id", auth(), async (req, res, next) => {
  try {
    const item = await prisma.inspection.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ message: "Inspection not found" });
    res.json(item);
  } catch (e) { next(e); }
});

router.post("/", auth(["SUPER_ADMIN", "FLEET_MANAGER", "VEHICLE_MANAGER", "STATION_MANAGER", "DRIVER"]), async (req, res, next) => {
  try {
    const data = parse(inspectionSchema, req.body);
    const item = await prisma.inspection.create({ data });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

router.put("/:id", auth(["SUPER_ADMIN", "FLEET_MANAGER", "VEHICLE_MANAGER", "STATION_MANAGER", "DRIVER"]), async (req, res, next) => {
  try {
    const data = parse(inspectionSchema.partial(), req.body);
    const existing = await prisma.inspection.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Inspection not found" });
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

router.delete("/:id", auth(["SUPER_ADMIN","ADMIN"]), async (req, res, next) => {
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
