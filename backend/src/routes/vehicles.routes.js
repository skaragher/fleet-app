import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, vehicleSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";
import { buildUserScope } from "../utils/userScope.js";

const router = Router();

router.get("/", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const where = {};

    if (scope.role === "DRIVER") {
      where.id = scope.assignedVehicleId || "__none__";
    } else if (scope.role === "STATION_MANAGER") {
      where.id = { in: scope.allowedVehicleIds.length ? scope.allowedVehicleIds : ["__none__"] };
    }

    const items = await prisma.vehicle.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (e) { next(e); }
});

router.get("/:id", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const id = req.params.id;
    if (scope.role === "DRIVER" && scope.assignedVehicleId && scope.assignedVehicleId !== id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (scope.role === "STATION_MANAGER" && !scope.allowedVehicleIds.includes(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

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
