import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, dispenseSchema } from "../validators.js";
import { buildUserScope } from "../utils/userScope.js";
import { z } from "zod";

const router = Router();

const dispenseCreateSchema = z.object({
  stationId: z.string().min(5),
  tankId: z.string().min(5),
  vehicleId: z.string().min(5).optional().nullable(),
  driverId: z.string().optional().nullable(),
  liters: z.number().int().positive(),
  unitPrice: z.number().optional().nullable(),
  odometerKm: z.number().int().nonnegative(),
  dispensedAt: z.string().datetime().optional(),
  notes: z.string().optional().nullable(),
  privateVehicle: z
    .object({
      plate: z.string().min(3),
      fuelType: z.enum(["DIESEL", "SUPER", "LUBRIFIANT", "HUILE"]),
      make: z.string().optional().nullable(),
      model: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const parseCreateDispense = (body) => {
  const r = dispenseCreateSchema.safeParse(body);
  if (!r.success) {
    const issues = r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    const err = new Error("ValidationError");
    err.status = 400;
    err.issues = issues;
    throw err;
  }
  return r.data;
};

// Catalogue des véhicules pour ravitaillement (EN_SERVICE + recherche matricule)
router.get("/vehicles-catalog", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const q = String(req.query.q || "").trim();
    const where = { status: "EN_SERVICE" };

    if (q) {
      where.plate = { contains: q, mode: "insensitive" };
    }

    if (scope.role === "DRIVER") {
      where.id = scope.assignedVehicleId || "__none__";
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: [{ plate: "asc" }],
      select: {
        id: true,
        plate: true,
        make: true,
        model: true,
        fuelType: true,
        odometerKm: true,
        status: true,
      },
    });

    res.json(vehicles);
  } catch (e) {
    console.error("Erreur GET /vehicles-catalog:", e);
    next(e);
  }
});

// Liste des ravitaillements
router.get("/", auth(), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const where = {};

    if (scope.role === "DRIVER") {
      where.vehicleId = scope.assignedVehicleId || "__none__";
    } else if (scope.role === "STATION_MANAGER") {
      where.stationId = { in: scope.assignedStationIds.length ? scope.assignedStationIds : ["__none__"] };
    }

    const items = await prisma.fuelDispense.findMany({
      where,
      orderBy: { dispensedAt: "desc" },
      include: { station: true, tank: true, vehicle: true, driver: true }
    });
    res.json(items);
  } catch (e) { 
    console.error("Erreur GET /dispenses:", e);
    next(e); 
  }
});

// Créer un ravitaillement avec sécurité Odomètre
router.post("/", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER","STATION_MANAGER"]), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const data = parseCreateDispense(req.body);

    if (scope.role === "STATION_MANAGER" && !scope.assignedStationIds.includes(data.stationId)) {
      return res.status(403).json({ message: "Forbidden: station non assignee" });
    }

    if (!data.vehicleId && !data.privateVehicle) {
      return res.status(400).json({ message: "Véhicule requis (enregistré ou privé)." });
    }
    
    const result = await prisma.$transaction(async (tx) => {
      let vehicleId = data.vehicleId;

      // Cas véhicule privé/non enregistré: on crée (ou réutilise) un véhicule avec ce matricule
      if (!vehicleId && data.privateVehicle) {
        const plate = String(data.privateVehicle.plate || "").trim().toUpperCase();
        let privateVehicle = await tx.vehicle.findUnique({ where: { plate } });

        if (!privateVehicle) {
          const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
          privateVehicle = await tx.vehicle.create({
            data: {
              plate,
              make: data.privateVehicle.make || "PRIVE",
              model: data.privateVehicle.model || "NON_ENREGISTRE",
              fuelType: data.privateVehicle.fuelType,
              odometerKm: data.odometerKm || 0,
              status: "EN_SERVICE",
              chassisNumber: `PRIVE-${uniqueSuffix}`,
              commissioningDate: new Date(),
            },
          });
        }

        vehicleId = privateVehicle.id;
      }

      // 1. Vérifier que le véhicule est en service et récupérer son kilométrage
      const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
      
      if (!vehicle || vehicle.status !== "EN_SERVICE") {
        throw Object.assign(new Error("Opération impossible : ce véhicule n'est pas en service."), { status: 400 });
      }

      // 2. Bloquer si le kilométrage saisi est inférieur au kilométrage actuel
      if (data.odometerKm < vehicle.odometerKm) {
        throw Object.assign(new Error(`Index incohérent : le compteur doit être ≥ ${vehicle.odometerKm} km.`), { status: 400 });
      }

      // 3. Vérifier le stock de la cuve
      const tank = await tx.tank.findUnique({ where: { id: data.tankId }});
      if (tank.currentL < data.liters) {
        throw Object.assign(new Error("Stock insuffisant dans la cuve"), { status: 400 });
      }

      // 4. Enregistrement
      const dispense = await tx.fuelDispense.create({
        data: {
          stationId: data.stationId,
          tankId: data.tankId,
          vehicleId,
          driverId: data.driverId || null,
          liters: data.liters,
          unitPrice: data.unitPrice || null,
          odometerKm: data.odometerKm,
          dispensedAt: new Date(),
          notes: data.notes || null,
        }
      });

      // 5. Mises à jour
      await tx.tank.update({ where: { id: tank.id }, data: { currentL: { decrement: data.liters } } });
      await tx.vehicle.update({ where: { id: vehicleId }, data: { odometerKm: data.odometerKm } });

      return dispense;
    });

    res.status(201).json(result);
  } catch (e) { 
    console.error("Erreur POST /dispenses:", e);
    next(e); 
  }
});

// AJOUTER CETTE ROUTE POUR LA MISE À JOUR
// Mettre à jour un ravitaillement
router.put("/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER","STATION_MANAGER"]), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const id = req.params.id;
    const data = parse(dispenseSchema, req.body);

    if (scope.role === "STATION_MANAGER" && !scope.assignedStationIds.includes(data.stationId)) {
      return res.status(403).json({ message: "Forbidden: station non assignee" });
    }
    
    // Vérifier si le ravitaillement existe
    const existingDispense = await prisma.fuelDispense.findUnique({
      where: { id },
      include: { vehicle: true, tank: true }
    });
    
    if (!existingDispense) {
      throw Object.assign(new Error("Ravitaillement non trouvé"), { status: 404 });
    }
    
    // Vérifier le délai de modification (30 minutes)
    const now = new Date();
    const dispenseTime = new Date(existingDispense.dispensedAt);
    const diffMinutes = (now - dispenseTime) / (1000 * 60);
    
    if (diffMinutes > 30) {
      throw Object.assign(new Error("Délai de modification dépassé (30 minutes)"), { status: 403 });
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. Vérifier que le véhicule est en service
      const vehicle = await tx.vehicle.findUnique({ where: { id: data.vehicleId } });
      
      if (!vehicle || vehicle.status !== "EN_SERVICE") {
        throw Object.assign(new Error("Opération impossible : ce véhicule n'est pas en service."), { status: 400 });
      }

      // 2. Vérifier le kilométrage
      if (data.odometerKm < vehicle.odometerKm) {
        throw Object.assign(new Error(`Index incohérent : le compteur doit être ≥ ${vehicle.odometerKm} km.`), { status: 400 });
      }

      // 3. Calculer la différence de volume
      const volumeDiff = data.liters - existingDispense.liters;
      
      // 4. Vérifier le stock de la cuve si on augmente le volume
      if (volumeDiff > 0) {
        const tank = await tx.tank.findUnique({ where: { id: data.tankId }});
        if (tank.currentL < volumeDiff) {
          throw Object.assign(new Error("Stock insuffisant dans la cuve pour cette modification"), { status: 400 });
        }
        
        // Mettre à jour le stock de la cuve
        await tx.tank.update({ 
          where: { id: data.tankId }, 
          data: { currentL: { decrement: volumeDiff } } 
        });
      }
      
      // 5. Si on diminue le volume, remettre le carburant dans la cuve
      if (volumeDiff < 0) {
        await tx.tank.update({ 
          where: { id: data.tankId }, 
          data: { currentL: { increment: Math.abs(volumeDiff) } } 
        });
      }

      // 6. Mettre à jour le ravitaillement
      const updatedDispense = await tx.fuelDispense.update({
        where: { id },
        data: {
          ...data,
          // Ne pas modifier dispensedAt lors de la mise à jour
        }
      });

      // 7. Mettre à jour le kilométrage du véhicule
      await tx.vehicle.update({ 
        where: { id: data.vehicleId }, 
        data: { odometerKm: data.odometerKm } 
      });

      return updatedDispense;
    });

    res.json(result);
  } catch (e) { 
    console.error("Erreur PUT /dispenses/:id:", e);
    next(e); 
  }
});

// Supprimer un ravitaillement (si nécessaire)
router.delete("/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const id = req.params.id;
    
    // Vérifier si le ravitaillement existe
    const existingDispense = await prisma.fuelDispense.findUnique({
      where: { id },
      include: { vehicle: true, tank: true }
    });
    
    if (!existingDispense) {
      throw Object.assign(new Error("Ravitaillement non trouvé"), { status: 404 });
    }
    
    // Vérifier le délai de suppression (30 minutes)
    const now = new Date();
    const dispenseTime = new Date(existingDispense.dispensedAt);
    const diffMinutes = (now - dispenseTime) / (1000 * 60);
    
    if (diffMinutes > 30) {
      throw Object.assign(new Error("Délai de suppression dépassé (30 minutes)"), { status: 403 });
    }
    
    await prisma.$transaction(async (tx) => {
      // Remettre le carburant dans la cuve
      await tx.tank.update({
        where: { id: existingDispense.tankId },
        data: { currentL: { increment: existingDispense.liters } }
      });
      
      // Supprimer le ravitaillement
      await tx.fuelDispense.delete({
        where: { id }
      });
    });

    res.status(204).send();
  } catch (e) { 
    console.error("Erreur DELETE /dispenses/:id:", e);
    next(e); 
  }
});

export default router;
