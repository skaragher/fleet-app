import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, insuranceSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";

const router = Router();

/**
 * GET / - Liste tous les contrats
 * Inclut les relations pour l'affichage (Plaque, Nom Assureur)
 */
router.get("/", auth(), async (_req, res, next) => {
  try {
    const items = await prisma.insurancePolicy.findMany({ 
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
    const item = await prisma.insurancePolicy.findUnique({ 
      where: { id: req.params.id },
      include: { vehicle: true, insurer: true }
    });
    if (!item) return res.status(404).json({ message: "Contrat introuvable" });
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
    const data = parse(insuranceSchema.partial(), {
      ...req.body,
      premium: req.body.premium ? Number(req.body.premium) : undefined,
      durationValue: req.body.durationValue ? Number(req.body.durationValue) : undefined
    });

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
