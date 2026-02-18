import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, driverSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";

const router = Router();

router.get("/", auth(), async (_req, res, next) => {
  try {
    const items = await prisma.driver.findMany({ orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (e) { next(e); }
});

router.get("/:id", auth(), async (req, res, next) => {
  try {
    const item = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ message: "Driver not found" });
    res.json(item);
  } catch (e) { next(e); }
});

router.post("/", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const data = parse(driverSchema, req.body);
    const item = await prisma.driver.create({ data });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

router.put("/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const data = parse(driverSchema.partial(), req.body);
    const item = await prisma.driver.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (e) { next(e); }
});

router.delete("/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    await prisma.driver.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.use(errorHandler);
export default router;
