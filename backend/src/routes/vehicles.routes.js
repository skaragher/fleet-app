import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, vehicleSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";

const router = Router();

router.get("/", auth(), async (_req, res, next) => {
  try {
    const items = await prisma.vehicle.findMany({ orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (e) { next(e); }
});

router.get("/:id", auth(), async (req, res, next) => {
  try {
    const item = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ message: "Vehicle not found" });
    res.json(item);
  } catch (e) { next(e); }
});

router.post("/", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const data = parse(vehicleSchema, req.body);
    const item = await prisma.vehicle.create({ data });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

router.put("/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const data = parse(vehicleSchema.partial(), req.body);
    const item = await prisma.vehicle.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (e) { next(e); }
});

router.delete("/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    // P2003 est le code Prisma pour la violation de contrainte de clé étrangère
    if (e.code === 'P2003') {
      return res.status(400).json({ 
        message: "Action impossible : Ce véhicule possède un historique (ravitaillements/entretiens/assurance/Visite technique). Changez son statut en 'HORS_SERVICE' à la place." 
      });
    }
    next(e);
  }
});

router.use(errorHandler);
export default router;
