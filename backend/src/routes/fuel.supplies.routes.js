import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, supplySchema } from "../validators.js";
import { buildUserScope } from "../utils/userScope.js";

const router = Router();

// ============================================
// LISTE DES APPROVISIONNEMENTS AVEC PAGINATION ET RECHERCHE
// ============================================

router.get("/supplies", auth(), async (req, res, next) => {
  try {
    console.log("GET /supplies - Récupération des approvisionnements avec pagination");
    
    // Récupérer les paramètres de requête
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Paramètres de recherche
    const searchDate = req.query.date ? new Date(req.query.date) : null;
    const stationId = req.query.stationId || null;
    const supplier = req.query.supplier || null;
    const tankId = req.query.tankId || null;
    
    console.log(`📊 Paramètres: page=${page}, limit=${limit}, date=${searchDate}, station=${stationId}, supplier=${supplier}`);
    
    // Construire les filtres
    const where = {};
    
    // Filtre par date (recherche sur une date spécifique)
    if (searchDate) {
      const startOfDay = new Date(searchDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(searchDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      where.deliveredAt = {
        gte: startOfDay,
        lte: endOfDay
      };
    }
    
    // Filtre par station
    if (stationId) where.stationId = stationId;

    const scope = await buildUserScope(req.user);
    if (scope.role === "FLEET_MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Forbidden"
      });
    }
    if (scope.role === "STATION_MANAGER") {
      where.stationId = { in: scope.assignedStationIds.length ? scope.assignedStationIds : ["__none__"] };
    } else if (scope.role === "DRIVER") {
      // Un driver ne gère pas les approvisionnements de station
      where.stationId = "__none__";
    }
    
    // Filtre par fournisseur (recherche partielle)
    if (supplier) {
      where.supplier = {
        contains: supplier,
        mode: 'insensitive'
      };
    }
    
    // Filtre par cuve
    if (tankId) {
      where.tankId = tankId;
    }
    
    // Compter le total avec les filtres
    const total = await prisma.fuelSupply.count({ where });
    
    // Récupérer les données avec pagination
    const items = await prisma.fuelSupply.findMany({
      where,
      orderBy: { deliveredAt: "desc" },
      skip,
      take: limit,
      include: { 
        station: { 
          select: { id: true, name: true, location: true }
        }, 
        tank: { 
          select: { 
            id: true, 
            name: true,
            fuelType: true, 
            capacityL: true, 
            currentL: true 
          }
        } 
      }
    });
    
    // Calculer la pagination
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // Récupérer la liste des stations pour les filtres
    const stations = await prisma.station.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    
    console.log(`✅ ${items.length}/${total} approvisionnements trouvés (page ${page}/${totalPages})`);
    
    // Réponse formatée
    res.json({
      success: true,
      message: `${items.length} approvisionnement(s) trouvé(s)`,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage
        },
        filters: {
          date: searchDate,
          stationId,
          supplier,
          tankId
        },
        stations // Pour les options de filtre dans le frontend
      }
    });
    
  } catch (e) { 
    console.error("❌ Erreur GET /supplies:", e);
    
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des approvisionnements",
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
    
    next(e); 
  }
});

// ============================================
// CRÉER UN NOUVEL APPROVISIONNEMENT
// ============================================

router.post("/supplies", auth(["SUPER_ADMIN","ADMIN","STATION_MANAGER"]), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    console.log("POST /supplies - Création d'un approvisionnement");
    console.log("Données reçues:", req.body);
    
    const data = parse(supplySchema, req.body);

    if (scope.role === "STATION_MANAGER" && !scope.assignedStationIds.includes(data.stationId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: station non assignee"
      });
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. Vérifier que la cuve existe
      const tank = await tx.tank.findUnique({
        where: { id: data.tankId }
      });
      
      if (!tank) {
        throw Object.assign(new Error("Cuve non trouvée"), { 
          status: 404,
          details: { tankId: data.tankId }
        });
      }
      
      // 2. Vérifier que la cuve appartient bien à la station spécifiée
      if (tank.stationId !== data.stationId) {
        throw Object.assign(new Error("La cuve n'appartient pas à cette station"), { 
          status: 400,
          details: { 
            tankId: data.tankId,
            tankStation: tank.stationId,
            requestedStation: data.stationId 
          }
        });
      }
      
      // 3. Vérifier la capacité de la cuve
      const newLevel = tank.currentL + data.deliveredL;
      if (newLevel > tank.capacityL) {
        const overflow = newLevel - tank.capacityL;
        const available = tank.capacityL - tank.currentL;
        
        throw Object.assign(new Error(
          `Dépassement de capacité : la cuve ne peut contenir que ${tank.capacityL}L maximum ` +
          `(${available}L disponible). Réduisez le volume de ${overflow}L.`
        ), { 
          status: 400,
          details: {
            currentLevel: tank.currentL,
            capacity: tank.capacityL,
            delivered: data.deliveredL,
            newLevel,
            overflow,
            available
          }
        });
      }
      
      // 4. Créer l'approvisionnement
      const supply = await tx.fuelSupply.create({
        data: {
          station: { connect: { id: data.stationId } },
          tank: { connect: { id: data.tankId } },
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
        data: { 
          currentL: { increment: data.deliveredL }
        }
      });
      
      console.log(`✅ Approvisionnement créé: ${supply.id}`);
      
      // Récupérer les données complètes pour la réponse
      const supplyWithDetails = await tx.fuelSupply.findUnique({
        where: { id: supply.id },
        include: {
          station: { select: { id: true, name: true } },
          tank: { select: { id: true, name: true, fuelType: true } }
        }
      });
      
      return supplyWithDetails;
    });
    
    res.status(201).json({
      success: true,
      message: "Approvisionnement créé avec succès",
      data: result
    });
    
  } catch (e) { 
    console.error("❌ Erreur POST /supplies:", e);
    
    if (e.status) {
      return res.status(e.status).json({ 
        success: false,
        message: e.message,
        details: e.details || undefined
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de l'approvisionnement",
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
    
    next(e); 
  }
});

// ============================================
// MODIFIER UN APPROVISIONNEMENT
// ============================================

router.put("/supplies/:id", auth(["SUPER_ADMIN","ADMIN","STATION_MANAGER"]), async (req, res, next) => {
  try {
    const scope = await buildUserScope(req.user);
    const { id } = req.params;
    console.log(`PUT /supplies/${id} - Modification d'un approvisionnement`);
    console.log("Données reçues:", req.body);
    
    const data = parse(supplySchema, req.body);

    if (scope.role === "STATION_MANAGER" && !scope.assignedStationIds.includes(data.stationId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: station non assignee"
      });
    }
    
    // 1. Vérifier que l'approvisionnement existe
    const existingSupply = await prisma.fuelSupply.findUnique({
      where: { id },
      include: { 
        tank: true,
        station: true 
      }
    });
    
    if (!existingSupply) {
      console.log(`❌ Approvisionnement ${id} non trouvé`);
      return res.status(404).json({ 
        success: false,
        message: "Approvisionnement non trouvé" 
      });
    }
    
    console.log("Approvisionnement existant:", existingSupply);
    
    // 2. Vérifier le délai de modification (30 minutes maximum)
    const now = new Date();
    const supplyTime = new Date(existingSupply.deliveredAt);
    const minutesDiff = (now - supplyTime) / (1000 * 60);
    
    console.log(`Délai de modification: ${minutesDiff.toFixed(2)} minutes`);
    
    if (minutesDiff > 30) {
      return res.status(403).json({ 
        success: false,
        message: "Modification impossible : délai de 30 minutes dépassé",
        details: {
          deliveredAt: existingSupply.deliveredAt,
          elapsedMinutes: Math.floor(minutesDiff)
        }
      });
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // 3. Annuler l'effet de l'ancien approvisionnement sur l'ancienne cuve
      await tx.tank.update({
        where: { id: existingSupply.tankId },
        data: { 
          currentL: { decrement: existingSupply.deliveredL }
        }
      });
      
      // 4. Vérifier que la station existe
      const station = await tx.station.findUnique({ 
        where: { id: data.stationId } 
      });
      
      if (!station) {
        throw Object.assign(new Error("Station non trouvée"), { 
          status: 404,
          details: { stationId: data.stationId }
        });
      }
      
      // 5. Vérifier que la nouvelle cuve existe
      const newTank = await tx.tank.findUnique({ 
        where: { id: data.tankId } 
      });
      
      if (!newTank) {
        throw Object.assign(new Error("Nouvelle cuve non trouvée"), { 
          status: 404,
          details: { tankId: data.tankId }
        });
      }
      
      // 6. Vérifier que la nouvelle cuve appartient à la station spécifiée
      if (newTank.stationId !== data.stationId) {
        throw Object.assign(new Error("La nouvelle cuve n'appartient pas à cette station"), { 
          status: 400,
          details: {
            tankStation: newTank.stationId,
            requestedStation: data.stationId
          }
        });
      }
      
      // 7. Vérifier la capacité pour le nouveau volume
      const newLevel = newTank.currentL + data.deliveredL;
      
      if (newLevel > newTank.capacityL) {
        const availableCapacity = newTank.capacityL - newTank.currentL;
        throw Object.assign(new Error(
          `Dépassement de capacité : la cuve ne peut accueillir que ${availableCapacity}L supplémentaires`
        ), { 
          status: 400,
          details: {
            currentLevel: newTank.currentL,
            capacity: newTank.capacityL,
            delivered: data.deliveredL,
            newLevel,
            available: availableCapacity
          }
        });
      }
      
      // 8. Mettre à jour l'approvisionnement
      const updatedSupply = await tx.fuelSupply.update({
        where: { id },
        data: {
          station: { connect: { id: data.stationId } },
          tank: { connect: { id: data.tankId } },
          supplier: data.supplier,
          deliveredL: data.deliveredL,
          unitPrice: data.unitPrice,
          deliveryRef: data.deliveryRef,
          notes: data.notes
        }
      });
      
      // 9. Appliquer le nouvel approvisionnement à la nouvelle cuve
      await tx.tank.update({
        where: { id: data.tankId },
        data: { 
          currentL: { increment: data.deliveredL }
        }
      });
      
      console.log(`✅ Approvisionnement ${id} mis à jour`);
      
      // Récupérer les données complètes
      const supplyWithDetails = await tx.fuelSupply.findUnique({
        where: { id },
        include: {
          station: { select: { id: true, name: true } },
          tank: { select: { id: true, name: true, fuelType: true } }
        }
      });
      
      return supplyWithDetails;
    });
    
    res.json({
      success: true,
      message: "Approvisionnement mis à jour avec succès",
      data: result
    });
    
  } catch (e) { 
    console.error(`❌ Erreur PUT /supplies/${req.params?.id}:`, e);
    
    if (e.status) {
      return res.status(e.status).json({ 
        success: false,
        message: e.message,
        details: e.details || undefined
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Erreur lors de la modification de l'approvisionnement",
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
    
    next(e); 
  }
});

// ============================================
// SUPPRIMER UN APPROVISIONNEMENT
// ============================================

router.delete("/supplies/:id", auth(["SUPER_ADMIN","ADMIN"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`DELETE /supplies/${id} - Suppression d'un approvisionnement`);
    
    // 1. Vérifier que l'approvisionnement existe
    const existingSupply = await prisma.fuelSupply.findUnique({
      where: { id },
      include: { 
        tank: true,
        station: { select: { id: true, name: true } }
      }
    });
    
    if (!existingSupply) {
      return res.status(404).json({ 
        success: false,
        message: "Approvisionnement non trouvé" 
      });
    }
    
    // 2. Vérifier le délai de suppression
    const now = new Date();
    const supplyTime = new Date(existingSupply.deliveredAt);
    const minutesDiff = (now - supplyTime) / (1000 * 60);
    
    if (minutesDiff > 30) {
      return res.status(403).json({ 
        success: false,
        message: "Suppression impossible : délai de 30 minutes dépassé",
        details: {
          deliveredAt: existingSupply.deliveredAt,
          elapsedMinutes: Math.floor(minutesDiff)
        }
      });
    }
    
    await prisma.$transaction(async (tx) => {
      // 3. Annuler l'effet sur la cuve
      await tx.tank.update({
        where: { id: existingSupply.tankId },
        data: { 
          currentL: { decrement: existingSupply.deliveredL }
        }
      });
      
      // 4. Supprimer l'approvisionnement
      await tx.fuelSupply.delete({ where: { id } });
    });
    
    console.log(`✅ Approvisionnement ${id} supprimé`);
    
    res.json({
      success: true,
      message: "Approvisionnement supprimé avec succès",
      data: {
        id,
        station: existingSupply.station,
        deliveredAt: existingSupply.deliveredAt,
        deliveredL: existingSupply.deliveredL
      }
    });
    
  } catch (e) { 
    console.error(`❌ Erreur DELETE /supplies/${req.params?.id}:`, e);
    
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression de l'approvisionnement",
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
    
    next(e); 
  }
});

// ============================================
// STATISTIQUES DES APPROVISIONNEMENTS
// ============================================

router.get("/supplies/stats", auth(), async (req, res, next) => {
  try {
    console.log("GET /supplies/stats - Récupération des statistiques");
    
    // Récupérer les paramètres de période
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const stationId = req.query.stationId || null;
    
    // Construire les filtres
    const where = {};
    
    if (startDate && endDate) {
      where.deliveredAt = {
        gte: startDate,
        lte: endDate
      };
    }
    
    if (stationId) {
      where.stationId = stationId;
    }
    
    // Récupérer toutes les données pour calculer les stats
    const supplies = await prisma.fuelSupply.findMany({
      where,
      include: {
        station: { select: { name: true } },
        tank: { select: { fuelType: true } }
      },
      orderBy: { deliveredAt: 'desc' }
    });
    
    // Calculer les statistiques
    const totalVolume = supplies.reduce((sum, s) => sum + s.deliveredL, 0);
    const totalCost = supplies.reduce((sum, s) => sum + (s.deliveredL * (s.unitPrice || 0)), 0);
    const avgPrice = supplies.length > 0 ? totalCost / totalVolume : 0;
    
    // Regrouper par station
    const byStation = {};
    supplies.forEach(supply => {
      const stationName = supply.station?.name || 'Inconnue';
      if (!byStation[stationName]) {
        byStation[stationName] = {
          volume: 0,
          cost: 0,
          count: 0
        };
      }
      byStation[stationName].volume += supply.deliveredL;
      byStation[stationName].cost += supply.deliveredL * (supply.unitPrice || 0);
      byStation[stationName].count++;
    });
    
    // Regrouper par mois
    const byMonth = {};
    supplies.forEach(supply => {
      const monthYear = new Date(supply.deliveredAt).toLocaleDateString('fr-FR', { 
        month: 'short', 
        year: 'numeric' 
      });
      if (!byMonth[monthYear]) {
        byMonth[monthYear] = {
          volume: 0,
          cost: 0,
          count: 0
        };
      }
      byMonth[monthYear].volume += supply.deliveredL;
      byMonth[monthYear].cost += supply.deliveredL * (supply.unitPrice || 0);
      byMonth[monthYear].count++;
    });
    
    res.json({
      success: true,
      message: "Statistiques récupérées avec succès",
      data: {
        summary: {
          totalSupplies: supplies.length,
          totalVolume,
          totalCost,
          avgPrice: Math.round(avgPrice * 100) / 100
        },
        byStation,
        byMonth,
        period: {
          startDate,
          endDate,
          stationId
        }
      }
    });
    
  } catch (e) {
    console.error("❌ Erreur GET /supplies/stats:", e);
    
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des statistiques",
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
    
    next(e);
  }
});

export default router;
