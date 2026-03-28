import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { buildUserScope } from "../utils/userScope.js";

const router = Router();

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "FLEET_MANAGER", "STATION_MANAGER"];

// Retourne les stationIds autorisés pour le rôle appelant
// FLEET_MANAGER / SUPER_ADMIN / ADMIN → null (pas de filtre)
// STATION_MANAGER → ses stations assignées
async function getAllowedStationIds(user) {
  const scope = await buildUserScope(user);
  if (scope.role === "STATION_MANAGER") {
    return scope.assignedStationIds?.length ? scope.assignedStationIds : ["__none__"];
  }
  return null; // pas de restriction
}

// ============================================================
// ÉTAT 1 : APPROVISIONNEMENTS (quantités reçues par date/fournisseur)
// GET /api/fuel/reports/supplies
// ============================================================
router.get("/supplies", auth(ALLOWED_ROLES), async (req, res, next) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const allowedStations = await getAllowedStationIds(req.user);
    const where = { deliveredAt: { gte: startDate, lte: endDate } };
    if (allowedStations) where.stationId = { in: allowedStations };

    const supplies = await prisma.fuelSupply.findMany({
      where,
      include: {
        station: { select: { id: true, name: true } },
        tank: { select: { id: true, name: true, fuelType: true } },
      },
      orderBy: { deliveredAt: "asc" },
    });

    // Regrouper par fournisseur
    const bySupplier = {};
    for (const s of supplies) {
      const key = s.supplier || "Inconnu";
      if (!bySupplier[key]) bySupplier[key] = { supplier: key, totalL: 0, totalCost: 0, count: 0, lines: [] };
      const cost = s.deliveredL * (s.unitPrice || 0);
      bySupplier[key].totalL += s.deliveredL;
      bySupplier[key].totalCost += cost;
      bySupplier[key].count++;
      bySupplier[key].lines.push({
        id: s.id,
        date: s.deliveredAt,
        station: s.station?.name || "-",
        tank: s.tank?.name || "-",
        fuelType: s.tank?.fuelType || "-",
        deliveredL: s.deliveredL,
        unitPrice: s.unitPrice,
        cost,
        deliveryRef: s.deliveryRef,
      });
    }

    // Regrouper par mois
    const byMonth = {};
    for (const s of supplies) {
      const key = new Date(s.deliveredAt).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
      if (!byMonth[key]) byMonth[key] = { month: key, totalL: 0, totalCost: 0, count: 0 };
      byMonth[key].totalL += s.deliveredL;
      byMonth[key].totalCost += s.deliveredL * (s.unitPrice || 0);
      byMonth[key].count++;
    }

    const totalL = supplies.reduce((s, x) => s + x.deliveredL, 0);
    const totalCost = supplies.reduce((s, x) => s + x.deliveredL * (x.unitPrice || 0), 0);

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        summary: { totalL, totalCost, totalSupplies: supplies.length },
        bySupplier: Object.values(bySupplier).sort((a, b) => b.totalL - a.totalL),
        byMonth: Object.values(byMonth),
        lines: supplies.map((s) => ({
          id: s.id,
          date: s.deliveredAt,
          supplier: s.supplier || "Inconnu",
          station: s.station?.name || "-",
          tank: s.tank?.name || "-",
          fuelType: s.tank?.fuelType || "-",
          deliveredL: s.deliveredL,
          unitPrice: s.unitPrice,
          cost: s.deliveredL * (s.unitPrice || 0),
          deliveryRef: s.deliveryRef,
        })),
      },
    });
  } catch (e) {
    console.error("❌ Erreur GET /reports/supplies:", e);
    next(e);
  }
});

// ============================================================
// ÉTAT 2 : SORTIES DE CARBURANT (distributions par véhicule/chauffeur)
// GET /api/fuel/reports/dispenses
// ============================================================
router.get("/dispenses", auth(ALLOWED_ROLES), async (req, res, next) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const allowedStationsD = await getAllowedStationIds(req.user);
    const whereD = { dispensedAt: { gte: startDate, lte: endDate } };
    if (allowedStationsD) whereD.stationId = { in: allowedStationsD };

    const dispenses = await prisma.fuelDispense.findMany({
      where: whereD,
      include: {
        vehicle: { select: { id: true, plate: true, make: true, model: true, fuelType: true } },
        driver: { select: { id: true, fullName: true, licenseNo: true } },
        station: { select: { id: true, name: true } },
        tank: { select: { id: true, name: true, fuelType: true } },
      },
      orderBy: { dispensedAt: "asc" },
    });

    // Regrouper par véhicule
    const byVehicle = {};
    for (const d of dispenses) {
      const key = d.vehicleId ? d.vehicle?.plate : (d.privatePlate || "Véhicule privé");
      const label = d.vehicleId
        ? `${d.vehicle?.plate} – ${d.vehicle?.make || ""} ${d.vehicle?.model || ""}`.trim()
        : (d.privatePlate ? `${d.privatePlate} (privé)` : "Véhicule privé");
      if (!byVehicle[key]) byVehicle[key] = { plate: key, label, totalL: 0, totalCost: 0, count: 0 };
      byVehicle[key].totalL += d.liters;
      byVehicle[key].totalCost += d.liters * (d.unitPrice || 0);
      byVehicle[key].count++;
    }

    // Regrouper par chauffeur
    const byDriver = {};
    for (const d of dispenses) {
      const key = d.driverId ? (d.driver?.fullName || d.driverId) : "Non renseigné";
      if (!byDriver[key]) byDriver[key] = { driver: key, totalL: 0, totalCost: 0, count: 0 };
      byDriver[key].totalL += d.liters;
      byDriver[key].totalCost += d.liters * (d.unitPrice || 0);
      byDriver[key].count++;
    }

    // Regrouper par station
    const byStation = {};
    for (const d of dispenses) {
      const key = d.station?.name || "Inconnue";
      if (!byStation[key]) byStation[key] = { station: key, totalL: 0, totalCost: 0, count: 0 };
      byStation[key].totalL += d.liters;
      byStation[key].totalCost += d.liters * (d.unitPrice || 0);
      byStation[key].count++;
    }

    const totalL = dispenses.reduce((s, x) => s + x.liters, 0);
    const totalCost = dispenses.reduce((s, x) => s + x.liters * (x.unitPrice || 0), 0);

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        summary: { totalL, totalCost, totalDispenses: dispenses.length },
        byVehicle: Object.values(byVehicle).sort((a, b) => b.totalL - a.totalL),
        byDriver: Object.values(byDriver).sort((a, b) => b.totalL - a.totalL),
        byStation: Object.values(byStation).sort((a, b) => b.totalL - a.totalL),
        lines: dispenses.map((d) => ({
          id: d.id,
          date: d.dispensedAt,
          vehicle: d.vehicleId ? d.vehicle?.plate : (d.privatePlate || "-"),
          driverName: d.driver?.fullName || "-",
          station: d.station?.name || "-",
          fuelType: d.tank?.fuelType || d.privateFuelType || "-",
          liters: d.liters,
          unitPrice: d.unitPrice,
          cost: d.liters * (d.unitPrice || 0),
          odometerKm: d.odometerKm,
          notes: d.notes,
        })),
      },
    });
  } catch (e) {
    console.error("❌ Erreur GET /reports/dispenses:", e);
    next(e);
  }
});

// ============================================================
// ÉTAT 3 : CONSOMMATIONS PAR VÉHICULE (suivi détaillé L/100km)
// GET /api/fuel/reports/consumption
// ============================================================
router.get("/consumption", auth(ALLOWED_ROLES), async (req, res, next) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Ravitaillements sur la période, véhicules internes uniquement
    const allowedStationsC = await getAllowedStationIds(req.user);
    const whereC = { dispensedAt: { gte: startDate, lte: endDate }, vehicleId: { not: null } };
    if (allowedStationsC) whereC.stationId = { in: allowedStationsC };

    const dispenses = await prisma.fuelDispense.findMany({
      where: whereC,
      include: {
        vehicle: { select: { id: true, plate: true, make: true, model: true, fuelType: true } },
        driver: { select: { id: true, fullName: true } },
      },
      orderBy: [{ vehicleId: "asc" }, { dispensedAt: "asc" }],
    });

    // Regrouper par véhicule
    const vehicleMap = {};
    for (const d of dispenses) {
      const vid = d.vehicleId;
      if (!vehicleMap[vid]) {
        vehicleMap[vid] = {
          vehicleId: vid,
          plate: d.vehicle?.plate || vid,
          make: d.vehicle?.make || "",
          model: d.vehicle?.model || "",
          fuelType: d.vehicle?.fuelType || "-",
          totalL: 0,
          count: 0,
          odometerFirst: d.odometerKm || 0,
          odometerLast: d.odometerKm || 0,
          events: [],
        };
      }
      vehicleMap[vid].totalL += d.liters;
      vehicleMap[vid].count++;
      if (d.odometerKm > vehicleMap[vid].odometerLast) vehicleMap[vid].odometerLast = d.odometerKm;
      if (d.odometerKm < vehicleMap[vid].odometerFirst && d.odometerKm > 0) vehicleMap[vid].odometerFirst = d.odometerKm;
      vehicleMap[vid].events.push({
        date: d.dispensedAt,
        liters: d.liters,
        odometerKm: d.odometerKm,
        driver: d.driver?.fullName || "-",
        cost: d.liters * (d.unitPrice || 0),
      });
    }

    // Calculer les indicateurs pour chaque véhicule
    const vehicles = Object.values(vehicleMap).map((v) => {
      const kmDriven = v.odometerLast - v.odometerFirst;
      const consumptionRate = kmDriven > 0 ? (v.totalL / kmDriven) * 100 : null;
      return {
        ...v,
        kmDriven,
        consumptionRate: consumptionRate ? Math.round(consumptionRate * 100) / 100 : null,
        avgPerFill: v.count > 0 ? Math.round(v.totalL / v.count) : 0,
      };
    });

    vehicles.sort((a, b) => b.totalL - a.totalL);

    const totalL = vehicles.reduce((s, v) => s + v.totalL, 0);
    const totalKm = vehicles.reduce((s, v) => s + v.kmDriven, 0);
    const avgFleet = totalKm > 0 ? (totalL / totalKm) * 100 : null;

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        summary: {
          totalL,
          totalKm,
          avgFleetConsumption: avgFleet ? Math.round(avgFleet * 100) / 100 : null,
          totalVehicles: vehicles.length,
        },
        vehicles,
      },
    });
  } catch (e) {
    console.error("❌ Erreur GET /reports/consumption:", e);
    next(e);
  }
});

// Normes de consommation standard par catégorie (L/100km)
const CATEGORY_NORMS = {
  CITADINE:     7,
  BERLINE_SUV:  10,
  PICKUP_4X4:   12,
  PETIT_CAMION: 18,
  POIDS_LOURD:  28,
  GROS_PORTEUR: 38,
};
const DEFAULT_NORM = 12;

// ============================================================
// ÉTAT 4 : COMPARATIF CONSOMMATION VS NORME (détection anomalies)
// GET /api/fuel/reports/comparison
// ============================================================
router.get("/comparison", auth(ALLOWED_ROLES), async (req, res, next) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    endDate.setHours(23, 59, 59, 999);
    // Norme globale de secours si le véhicule n'a pas de catégorie
    const fallbackNorm = parseFloat(req.query.norm) || DEFAULT_NORM;

    const allowedStationsV = await getAllowedStationIds(req.user);
    const whereV = { dispensedAt: { gte: startDate, lte: endDate }, vehicleId: { not: null } };
    if (allowedStationsV) whereV.stationId = { in: allowedStationsV };

    const dispenses = await prisma.fuelDispense.findMany({
      where: whereV,
      include: {
        vehicle: { select: { id: true, plate: true, make: true, model: true, fuelType: true, category: true } },
      },
      orderBy: [{ vehicleId: "asc" }, { dispensedAt: "asc" }],
    });

    // Regrouper par véhicule
    const vehicleMap = {};
    for (const d of dispenses) {
      const vid = d.vehicleId;
      if (!vehicleMap[vid]) {
        vehicleMap[vid] = {
          vehicleId: vid,
          plate: d.vehicle?.plate || vid,
          make: d.vehicle?.make || "",
          model: d.vehicle?.model || "",
          fuelType: d.vehicle?.fuelType || "-",
          category: d.vehicle?.category || null,
          totalL: 0,
          count: 0,
          odometerFirst: d.odometerKm || 0,
          odometerLast: d.odometerKm || 0,
        };
      }
      vehicleMap[vid].totalL += d.liters;
      vehicleMap[vid].count++;
      if (d.odometerKm > vehicleMap[vid].odometerLast) vehicleMap[vid].odometerLast = d.odometerKm;
      if (d.odometerKm < vehicleMap[vid].odometerFirst && d.odometerKm > 0) vehicleMap[vid].odometerFirst = d.odometerKm;
    }

    const vehicles = Object.values(vehicleMap).map((v) => {
      // Utiliser la norme de la catégorie du véhicule, sinon la norme de secours
      const normL100km = v.category ? (CATEGORY_NORMS[v.category] ?? fallbackNorm) : fallbackNorm;
      const kmDriven = v.odometerLast - v.odometerFirst;
      const actualRate = kmDriven > 0 ? (v.totalL / kmDriven) * 100 : null;
      const normL = kmDriven > 0 ? (normL100km / 100) * kmDriven : null;
      const excessL = normL !== null ? v.totalL - normL : null;
      const ecartPct = normL !== null && normL > 0 ? ((v.totalL - normL) / normL) * 100 : null;

      let status = "ok";
      if (ecartPct !== null) {
        if (ecartPct > 25) status = "critique";
        else if (ecartPct > 10) status = "attention";
        else if (ecartPct < -10) status = "economie";
      }

      return {
        ...v,
        kmDriven,
        actualRate: actualRate ? Math.round(actualRate * 100) / 100 : null,
        normRate: normL100km,
        normL: normL ? Math.round(normL) : null,
        excessL: excessL ? Math.round(excessL) : null,
        ecartPct: ecartPct ? Math.round(ecartPct * 10) / 10 : null,
        status,
      };
    });

    vehicles.sort((a, b) => (b.ecartPct || 0) - (a.ecartPct || 0));

    const critiques = vehicles.filter((v) => v.status === "critique").length;
    const attentions = vehicles.filter((v) => v.status === "attention").length;
    const economies = vehicles.filter((v) => v.status === "economie").length;
    const normaux = vehicles.filter((v) => v.status === "ok").length;

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        normL100km: fallbackNorm,
        summary: { total: vehicles.length, critiques, attentions, economies, normaux },
        vehicles,
      },
    });
  } catch (e) {
    console.error("❌ Erreur GET /reports/comparison:", e);
    next(e);
  }
});

export default router;
