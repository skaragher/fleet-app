import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, insuranceSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";
import { buildUserScope } from "../utils/userScope.js";

const router = Router();

/**
 * GET / - Liste tous les contrats
 * Inclut les relations pour l'affichage (Plaque, Nom Assureur)
 */
router.get("/", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const where = {};
    if (scope.role === "DRIVER") {
      where.vehicleId = scope.assignedVehicleId || "__none__";
    } else if (scope.role === "STATION_MANAGER") {
      where.vehicleId = { in: scope.allowedVehicleIds.length ? scope.allowedVehicleIds : ["__none__"] };
    }

    const items = await prisma.insurancePolicy.findMany({ 
      where,
      include: { 
        vehicle: true,
        insurer: true 
      },
      orderBy: { endAt: "asc" }
    });
    res.json(items);
  } catch (e) { next(e); }
});

/**
 * GET /:id - Détails d'un contrat spécifique
 */
router.get("/:id", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const item = await prisma.insurancePolicy.findUnique({ 
      where: { id: req.params.id },
      include: { vehicle: true, insurer: true }
    });
    if (!item) return res.status(404).json({ message: "Contrat introuvable" });

    if (scope.role === "DRIVER" && item.vehicleId !== scope.assignedVehicleId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (scope.role === "STATION_MANAGER" && !scope.allowedVehicleIds.includes(item.vehicleId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(item);
  } catch (e) { next(e); }
});

/**
 * POST / - Création d'un contrat avec Durée
 */
router.post("/", auth(["SUPER_ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    // 1. Validation : On force la conversion en Number pour Prisma
    const data = parse(insuranceSchema, {
      ...req.body,
      premium: req.body.premium ? Number(req.body.premium) : 0,
      durationValue: req.body.durationValue ? Number(req.body.durationValue) : null
    });

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle || vehicle.status !== "EN_SERVICE") {
      return res.status(400).json({ message: "Opération impossible : le véhicule doit être EN_SERVICE." });
    }

    // 2. Création en base de données
    const item = await prisma.insurancePolicy.create({ 
      data: {
        vehicleId: data.vehicleId,
        insurerId: data.insurerId,
        insurancesType: data.insurancesType,
        policyNo: data.policyNo,
        premium: data.premium,
        durationValue: data.durationValue, // Enregistré !
        durationUnit: data.durationUnit,   // Enregistré !
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt)
      },
      include: { 
        vehicle: true, 
        insurer: true 
      }
    });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

/**
 * PUT /:id - Mise à jour d'un contrat
 */
router.put("/:id", auth(["SUPER_ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const existing = await prisma.insurancePolicy.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Contrat introuvable" });

    const data = parse(insuranceSchema.partial(), {
      ...req.body,
      premium: req.body.premium ? Number(req.body.premium) : undefined,
      durationValue: req.body.durationValue ? Number(req.body.durationValue) : undefined
    });

    const targetVehicleId = data.vehicleId || existing.vehicleId;
    const vehicle = await prisma.vehicle.findUnique({ where: { id: targetVehicleId } });
    if (!vehicle || vehicle.status !== "EN_SERVICE") {
      return res.status(400).json({ message: "Opération impossible : le véhicule doit être EN_SERVICE." });
    }

    const item = await prisma.insurancePolicy.update({ 
      where: { id: req.params.id }, 
      data: {
        ...data,
        startAt: data.startAt ? new Date(data.startAt) : undefined,
        endAt: data.endAt ? new Date(data.endAt) : undefined,
      },
      include: { vehicle: true, insurer: true }
    });
    res.json(item);
  } catch (e) { next(e); }
});

/**
 * DELETE /:id - Suppression d'un contrat
 */
router.delete("/:id", auth(["SUPER_ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    await prisma.insurancePolicy.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.use(errorHandler);
export default router;
