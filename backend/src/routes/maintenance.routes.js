// routes/maintenance.js
import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, maintenanceSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";
import { buildUserScope } from "../utils/userScope.js";

const router = Router();

router.get("/", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const where = {};

    if (scope.role === "DRIVER") {
      where.vehicleId = scope.assignedVehicleId || "__none__";
    } else if (scope.role === "STATION_MANAGER") {
      where.vehicleId = { in: scope.allowedVehicleIds.length ? scope.allowedVehicleIds : ["__none__"] };
    }

    const items = await prisma.maintenance.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (e) { next(e); }
});

router.post("/", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const data = parse(maintenanceSchema, req.body);
    const item = await prisma.maintenance.create({ data });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

router.put("/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    // Le partial() est CRUCIAL ici pour permettre la clôture sans renvoyer tout le schéma
    const data = parse(maintenanceSchema.partial(), req.body);
    const item = await prisma.maintenance.update({ 
      where: { id: req.params.id }, 
      data 
    });
    res.json(item);
  } catch (e) { next(e); }
});

router.delete("/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    await prisma.maintenance.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.use(errorHandler);
export default router;
