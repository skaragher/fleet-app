// routes/maintenance.js
import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, maintenanceSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";

const router = Router();

router.get("/", auth(), async (_req, res, next) => {
  try {
    const items = await prisma.maintenance.findMany({ orderBy: { createdAt: "desc" } });
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
