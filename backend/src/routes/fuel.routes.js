import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, dispenseSchema, supplySchema } from "../validators.js";

const router = Router();

// ============================================
// RAVITAILLEMENTS (DISPENSES) - Routes existantes
// ============================================

// Liste des ravitaillements
router.get("/dispenses", auth(), async (_req, res, next) => {
  try {
    const items = await prisma.fuelDispense.findMany({
      orderBy: { dispensedAt: "desc" },
      include: { station: true, tank: true, vehicle: true, driver: true }
    });
    res.json(items);
  } catch (e) { next(e); }
});

// Créer un ravitaillement avec sécurité Odomètre
router.post("/dispenses", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER","STATION_MANAGER"]), async (req, res, next) => {
  try {
    const data = parse(dispenseSchema, req.body);
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. Vérifier que le véhicule est en service et récupérer son kilométrage
      const vehicle = await tx.vehicle.findUnique({ where: { id: data.vehicleId } });
      
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
        data: { ...data, dispensedAt: new Date() }
      });

      // 5. Mises à jour
      await tx.tank.update({ where: { id: tank.id }, data: { currentL: { decrement: data.liters } } });
      await tx.vehicle.update({ where: { id: data.vehicleId }, data: { odometerKm: data.odometerKm } });

      return dispense;
    });

    res.status(201).json(result);
  } catch (e) { next(e); }
});

// ============================================
// APPROVISIONNEMENTS (SUPPLIES) - Routes corrigées
// ============================================

// Liste des approvisionnements
router.get("/supplies", auth(), async (_req, res, next) => {
  try {
    const items = await prisma.fuelSupply.findMany({
      orderBy: { deliveredAt: "desc" },
      include: { 
        station: { 
          select: { id: true, name: true }
        }, 
        tank: { 
          select: { id: true, fuelType: true, capacityL: true, currentL: true }
        } 
      }
    });
    res.json(items);
  } catch (e) { next(e); }
});

// Créer un nouvel approvisionnement
router.post("/supplies", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER","STATION_MANAGER"]), async (req, res, next) => {
  try {
    const data = parse(supplySchema, req.body);
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. Vérifier que la cuve existe
      const tank = await tx.tank.findUnique({
        where: { id: data.tankId },
        include: { station: true }
      });
      
      if (!tank) {
        throw Object.assign(new Error("Cuve non trouvée"), { status: 404 });
      }
      
      // 2. Vérifier que la cuve appartient bien à la station spécifiée
      if (tank.stationId !== data.stationId) {
        throw Object.assign(new Error("La cuve n'appartient pas à cette station"), { status: 400 });
      }
      
      // 3. Vérifier la capacité de la cuve
      const newLevel = tank.currentL + data.deliveredL;
      if (newLevel > tank.capacityL) {
        const overflow = newLevel - tank.capacityL;
        throw Object.assign(new Error(
          `Dépassement de capacité : la cuve ne peut contenir que ${tank.capacityL}L maximum. ` +
          `Réduisez le volume de ${overflow}L ou choisissez une autre cuve.`
        ), { status: 400 });
      }
      
      // 4. Créer l'approvisionnement AVEC SYNTAXE CORRECTE
      const supply = await tx.fuelSupply.create({
        data: {
          station: { connect: { id: data.stationId } },  // CORRIGÉ : utiliser connect
          tank: { connect: { id: data.tankId } },        // CORRIGÉ : utiliser connect
          supplier: data.supplier,
          deliveredL: data.deliveredL,
          unitPrice: data.unitPrice,
          deliveryRef: data.deliveryRef,
          notes: data.notes,
          deliveredAt: data.deliveredAt || new Date()
        }
      });
      
      // 5. Mettre à jour le niveau de la cuve
      await tx.tank.update({
        where: { id: data.tankId },
        data: { currentL: { increment: data.deliveredL } }
      });
      
      return supply;
    });
    
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// Modifier un approvisionnement
router.put("/supplies/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER","STATION_MANAGER"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = parse(supplySchema, req.body);
    
    // 1. Vérifier que l'approvisionnement existe et récupérer les données originales
    const existingSupply = await prisma.fuelSupply.findUnique({
      where: { id },
      include: { tank: true }
    });
    
    if (!existingSupply) {
      return res.status(404).json({ message: "Approvisionnement non trouvé" });
    }
    
    // 2. Vérifier le délai de modification (30 minutes maximum)
    const now = new Date();
    const supplyTime = new Date(existingSupply.deliveredAt);
    const minutesDiff = (now - supplyTime) / (1000 * 60);
    
    if (minutesDiff > 30) {
      return res.status(403).json({ 
        message: "Modification impossible : délai de 30 minutes dépassé" 
      });
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // 3. Annuler l'effet de l'ancien approvisionnement sur la cuve
      await tx.tank.update({
        where: { id: existingSupply.tankId },
        data: { currentL: { decrement: existingSupply.deliveredL } }
      });
      
      // 4. Vérifier que la nouvelle cuve existe
      const tank = await tx.tank.findUnique({ 
        where: { id: data.tankId } 
      });
      
      if (!tank) {
        throw Object.assign(new Error("Nouvelle cuve non trouvée"), { status: 404 });
      }
      
      // 5. Vérifier que la nouvelle cuve appartient à la station spécifiée
      if (tank.stationId !== data.stationId) {
        throw Object.assign(new Error("La nouvelle cuve n'appartient pas à cette station"), { status: 400 });
      }
      
      // 6. Vérifier la capacité pour le nouveau volume
      // On calcule le niveau après avoir retiré l'ancien approvisionnement
      const newLevel = tank.currentL + data.deliveredL;
      
      if (newLevel > tank.capacityL) {
        const availableCapacity = tank.capacityL - tank.currentL;
        throw Object.assign(new Error(
          `Dépassement de capacité : la cuve ne peut accueillir que ${availableCapacity}L supplémentaires`
        ), { status: 400 });
      }
      
      // 7. Mettre à jour l'approvisionnement AVEC SYNTAXE CORRECTE
      const updatedSupply = await tx.fuelSupply.update({
        where: { id },
        data: {
          station: { connect: { id: data.stationId } },  // CORRIGÉ : utiliser connect
          tank: { connect: { id: data.tankId } },        // CORRIGÉ : utiliser connect
          supplier: data.supplier,
          deliveredL: data.deliveredL,
          unitPrice: data.unitPrice,
          deliveryRef: data.deliveryRef,
          notes: data.notes
          // NE PAS inclure updatedAt car pas dans le modèle
        }
      });
      
      // 8. Appliquer le nouvel approvisionnement à la cuve
      await tx.tank.update({
        where: { id: data.tankId },
        data: { currentL: { increment: data.deliveredL } }
      });
      
      return updatedSupply;
    });
    
    res.json(result);
  } catch (e) { next(e); }
});

// Supprimer un approvisionnement
router.delete("/supplies/:id", auth(["SUPER_ADMIN","ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 1. Vérifier que l'approvisionnement existe
    const existingSupply = await prisma.fuelSupply.findUnique({
      where: { id },
      include: { tank: true }
    });
    
    if (!existingSupply) {
      return res.status(404).json({ message: "Approvisionnement non trouvé" });
    }
    
    // 2. Vérifier le délai de suppression (30 minutes maximum)
    const now = new Date();
    const supplyTime = new Date(existingSupply.deliveredAt);
    const minutesDiff = (now - supplyTime) / (1000 * 60);
    
    if (minutesDiff > 30) {
      return res.status(403).json({ 
        message: "Suppression impossible : délai de 30 minutes dépassé" 
      });
    }
    
    await prisma.$transaction(async (tx) => {
      // 3. Annuler l'effet sur la cuve
      await tx.tank.update({
        where: { id: existingSupply.tankId },
        data: { currentL: { decrement: existingSupply.deliveredL } }
      });
      
      // 4. Supprimer l'approvisionnement
      await tx.fuelSupply.delete({ where: { id } });
    });
    
    res.status(204).send();
  } catch (e) { next(e); }
});

// Exporter le routeur
export default router;