import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, stationSchema, tankSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";
import { buildUserScope } from "../utils/userScope.js";

const router = Router();

// --- STATIONS ---

router.get("/", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    if (scope.role === "FLEET_MANAGER") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const where = {};
    if (scope.role === "STATION_MANAGER") {
      where.id = { in: scope.assignedStationIds.length ? scope.assignedStationIds : ["__none__"] };
    }

    const stations = await prisma.station.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { tanks: true }
    });
    res.json(stations);
  } catch (e) { next(e); }
});

router.post("/", auth(["SUPER_ADMIN","ADMIN", "FUEL_OPERATOR"]), async (req, res, next) => {
  try {
    const data = parse(stationSchema, req.body);
    const station = await prisma.station.create({ data });
    res.status(201).json(station);
  } catch (e) { next(e); }
});
//modifier une station
router.put("/:id", auth(["SUPER_ADMIN","ADMIN"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = parse(stationSchema, req.body); // Valide name, location, address, phone

    const updatedStation = await prisma.station.update({
      where: { id },
      data
    });
    res.json(updatedStation);
  } catch (e) { next(e); }
});

//supprimer une station
router.delete("/:id", auth(["SUPER_ADMIN","ADMIN"]), async (req, res, next) => {
  const { id } = req.params;
  try {
    const tanks = await prisma.tank.findMany({ where: { stationId: id } });

    for (const tank of tanks) {
      const hasHistory = await prisma.fuelSupply.findFirst({ where: { tankId: tank.id } }) ||
                         await prisma.fuelDispense.findFirst({ where: { tankId: tank.id } });

      if (hasHistory) {
        return res.status(400).json({
          message: `Impossible de supprimer la station. La cuve ${tank.fuelType} (${tank.id}) a un historique.`,
        });
      }
      await prisma.tank.delete({ where: { id: tank.id } });
    }

    await prisma.station.delete({ where: { id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// --- TANKS (CUVES) ---

// Création d'une cuve
router.post("/:stationId/tanks", auth(["SUPER_ADMIN","ADMIN", "FUEL_OPERATOR"]), async (req, res, next) => {
  try {
    const { stationId } = req.params;
    
    // IMPORTANT : Assurez-vous que tankSchema dans validators.js accepte le champ "name"
    const data = parse(tankSchema, req.body);

    const tank = await prisma.tank.create({ 
      data: { 
        ...data, 
        stationId: stationId 
      } 
    });
    res.status(201).json(tank);
  } catch (e) { 
    console.error("Erreur Prisma:", e);
    next(e); 
  }
});

// Mise à jour d'une cuve
router.put("/tanks/:id", auth(["SUPER_ADMIN","ADMIN", "FUEL_OPERATOR"]), async (req, res, next) => {
  const { id } = req.params;
  try {
    // On valide les données avec le même schéma que la création
    const data = parse(tankSchema, req.body);

    const updatedTank = await prisma.tank.update({
      where: { id },
      data: {
        name: data.name,
        fuelType: data.fuelType,
        capacityL: data.capacityL,
        lowAlertL: data.lowAlertL,
        // On ne met pas à jour currentL ici pour la sécurité
      }
    });
    res.json(updatedTank);
  } catch (e) {
    console.error("Erreur Update Prisma:", e);
    next(e);
  }
});

// Suppression d'une cuve
router.delete("/tanks/:id", auth(["SUPER_ADMIN","ADMIN"]), async (req, res, next) => {
  const { id } = req.params;
  try {
    const fuelSupply = await prisma.fuelSupply.findFirst({ where: { tankId: id } });
    const fuelDispense = await prisma.fuelDispense.findFirst({ where: { tankId: id } });

    if (fuelSupply || fuelDispense) {
      return res.status(400).json({
        message: "Impossible de supprimer la cuve : historique de mouvements existant.",
      });
    }

    await prisma.tank.delete({ where: { id } });
    res.status(200).json({ message: "Cuve supprimée avec succès." });
  } catch (e) { next(e); }
});

router.use(errorHandler);
export default router;
