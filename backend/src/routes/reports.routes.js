import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { buildUserScope } from "../utils/userScope.js";

const router = Router();
const ADMIN_ROLES  = ["SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"];
const ALL_ROLES    = ["SUPER_ADMIN", "ADMIN", "FLEET_MANAGER", "STATION_MANAGER"];

// Normes de consommation standard par catégorie (L/100km)
const CATEGORY_NORMS = {
  CITADINE:     7,
  BERLINE_SUV:  10,
  PICKUP_4X4:   12,
  PETIT_CAMION: 18,
  POIDS_LOURD:  28,
  GROS_PORTEUR: 38,
};

function getDateRange(req) {
  const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), 0, 1);
  const endDate   = req.query.endDate   ? new Date(req.query.endDate)   : new Date();
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

async function getStationScope(user) {
  const scope = await buildUserScope(user);
  if (scope.role === "STATION_MANAGER") {
    return scope.assignedStationIds?.length ? scope.assignedStationIds : ["__none__"];
  }
  return null; // pas de filtre pour FLEET_MANAGER / SUPER_ADMIN
}

// ============================================================
// FINANCIER : DÉPENSES EN CARBURANT
// GET /api/reports/financial/expenses
// ============================================================
router.get("/financial/expenses", auth(ALL_ROLES), async (req, res, next) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const stationIds = await getStationScope(req.user);
    const where = { dispensedAt: { gte: startDate, lte: endDate } };
    if (stationIds) where.stationId = { in: stationIds };

    const dispenses = await prisma.fuelDispense.findMany({
      where,
      include: {
        vehicle: { select: { id: true, plate: true, make: true, model: true } },
        station: { select: { id: true, name: true } },
        driver:  { select: { id: true, fullName: true } },
      },
      orderBy: { dispensedAt: "asc" },
    });

    const byMonth = {};
    for (const d of dispenses) {
      const key = new Date(d.dispensedAt).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
      if (!byMonth[key]) byMonth[key] = { month: key, totalL: 0, totalCost: 0, count: 0 };
      byMonth[key].totalL    += d.liters;
      byMonth[key].totalCost += d.liters * (d.unitPrice || 0);
      byMonth[key].count++;
    }

    const byVehicle = {};
    for (const d of dispenses) {
      const key = d.vehicleId ? (d.vehicle?.plate || d.vehicleId) : (d.privatePlate || "Privé");
      if (!byVehicle[key]) byVehicle[key] = { vehicle: key, totalL: 0, totalCost: 0, count: 0 };
      byVehicle[key].totalL    += d.liters;
      byVehicle[key].totalCost += d.liters * (d.unitPrice || 0);
      byVehicle[key].count++;
    }

    const byStation = {};
    for (const d of dispenses) {
      const key = d.station?.name || "Inconnue";
      if (!byStation[key]) byStation[key] = { station: key, totalL: 0, totalCost: 0, count: 0 };
      byStation[key].totalL    += d.liters;
      byStation[key].totalCost += d.liters * (d.unitPrice || 0);
      byStation[key].count++;
    }

    const totalL    = dispenses.reduce((s, d) => s + d.liters, 0);
    const totalCost = dispenses.reduce((s, d) => s + d.liters * (d.unitPrice || 0), 0);

    res.json({ success: true, data: {
      period: { startDate, endDate },
      summary: { totalL, totalCost, count: dispenses.length },
      byMonth:   Object.values(byMonth),
      byVehicle: Object.values(byVehicle).sort((a, b) => b.totalCost - a.totalCost),
      byStation: Object.values(byStation).sort((a, b) => b.totalCost - a.totalCost),
      lines: dispenses.map(d => ({
        id: d.id, date: d.dispensedAt,
        vehicle:  d.vehicleId ? d.vehicle?.plate : (d.privatePlate || "-"),
        driver:   d.driver?.fullName || "-",
        station:  d.station?.name || "-",
        liters:   d.liters,
        unitPrice: d.unitPrice,
        cost:     d.liters * (d.unitPrice || 0),
      })),
    }});
  } catch (e) {
    console.error("❌ GET /reports/financial/expenses:", e);
    next(e);
  }
});

// ============================================================
// VÉHICULES : AFFECTATIONS VÉHICULES / CHAUFFEURS
// GET /api/reports/vehicles/assignments
// ============================================================
router.get("/vehicles/assignments", auth(ADMIN_ROLES), async (req, res, next) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const onlyActive = req.query.active === "true";

    const [userAssignments, driverAssignments] = await Promise.all([
      prisma.userVehicleAssignment.findMany({
        where: onlyActive
          ? { unassignedAt: null }
          : { assignedAt: { gte: startDate, lte: endDate } },
        include: {
          user:    { select: { id: true, name: true, email: true, role: true } },
          vehicle: { select: { id: true, plate: true, make: true, model: true, status: true } },
        },
        orderBy: { assignedAt: "desc" },
      }),
      prisma.vehicleAssignment.findMany({
        where: onlyActive
          ? { endDate: null }
          : { startDate: { gte: startDate, lte: endDate } },
        include: {
          vehicle: { select: { id: true, plate: true, make: true, model: true, status: true } },
          driver:  { select: { id: true, fullName: true, licenseNo: true } },
        },
        orderBy: { startDate: "desc" },
      }),
    ]);

    res.json({ success: true, data: {
      period: { startDate, endDate },
      summary: {
        totalUserAssignments:   userAssignments.length,
        activeUserAssignments:  userAssignments.filter(a => !a.unassignedAt).length,
        totalDriverAssignments: driverAssignments.length,
        activeDriverAssignments: driverAssignments.filter(a => !a.endDate).length,
      },
      userAssignments: userAssignments.map(a => ({
        id: a.id,
        userName:      a.user?.name  || a.userName  || "-",
        userEmail:     a.user?.email || a.userEmail || "-",
        userRole:      a.user?.role  || "-",
        vehicle:       a.vehicle?.plate || "-",
        vehicleLabel:  `${a.vehicle?.make || ""} ${a.vehicle?.model || ""}`.trim(),
        vehicleStatus: a.vehicle?.status || "-",
        assignedAt:    a.assignedAt,
        unassignedAt:  a.unassignedAt,
        active:        !a.unassignedAt,
        notes:         a.notes,
      })),
      driverAssignments: driverAssignments.map(a => ({
        id: a.id,
        driverName:    a.driver?.fullName || "-",
        licenseNo:     a.driver?.licenseNo || "-",
        vehicle:       a.vehicle?.plate || "-",
        vehicleLabel:  `${a.vehicle?.make || ""} ${a.vehicle?.model || ""}`.trim(),
        vehicleStatus: a.vehicle?.status || "-",
        startDate:     a.startDate,
        endDate:       a.endDate,
        active:        !a.endDate,
      })),
    }});
  } catch (e) {
    console.error("❌ GET /reports/vehicles/assignments:", e);
    next(e);
  }
});

// ============================================================
// VÉHICULES : HISTORIQUE DES ACTIVITÉS PAR VÉHICULE
// GET /api/reports/vehicles/activity
// ============================================================
router.get("/vehicles/activity", auth(ADMIN_ROLES), async (req, res, next) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const vehicleId = req.query.vehicleId || null;

    const vehicles = await prisma.vehicle.findMany({
      where: vehicleId ? { id: vehicleId } : {},
      select: { id: true, plate: true, make: true, model: true, fuelType: true, status: true, odometerKm: true },
    });

    const results = await Promise.all(vehicles.map(async (v) => {
      const [dispenses, maintenances, inspections] = await Promise.all([
        prisma.fuelDispense.findMany({
          where: { vehicleId: v.id, dispensedAt: { gte: startDate, lte: endDate } },
          orderBy: { dispensedAt: "asc" },
        }),
        prisma.maintenance.findMany({
          where: { vehicleId: v.id, OR: [
            { doneAt: { gte: startDate, lte: endDate } },
            { dueAt:  { gte: startDate, lte: endDate } },
          ]},
          orderBy: { createdAt: "desc" },
        }),
        prisma.inspection.findMany({
          where: { vehicleId: v.id, OR: [
            { doneAt:       { gte: startDate, lte: endDate } },
            { scheduledAt:  { gte: startDate, lte: endDate } },
          ]},
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const totalFuelL          = dispenses.reduce((s, d) => s + d.liters, 0);
      const totalFuelCost       = dispenses.reduce((s, d) => s + d.liters * (d.unitPrice || 0), 0);
      const totalMaintenanceCost = maintenances.reduce((s, m) => s + (m.cost || 0), 0);

      return {
        vehicleId: v.id, plate: v.plate, make: v.make, model: v.model,
        fuelType: v.fuelType, status: v.status, odometerKm: v.odometerKm,
        fuelEvents: dispenses.length, totalFuelL, totalFuelCost,
        maintenanceEvents: maintenances.length, totalMaintenanceCost,
        inspectionEvents:  inspections.length,
        totalCost: totalFuelCost + totalMaintenanceCost,
        timeline: [
          ...dispenses.map(d  => ({ type: "fuel",        date: d.dispensedAt,         detail: `${d.liters}L`, cost: d.liters * (d.unitPrice || 0) })),
          ...maintenances.map(m => ({ type: "maintenance", date: m.doneAt || m.dueAt,   detail: m.maintenanceType, cost: m.cost || 0 })),
          ...inspections.map(i  => ({ type: "inspection",  date: i.doneAt || i.scheduledAt, detail: i.type, cost: i.cost || 0 })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date)),
      };
    }));

    results.sort((a, b) => b.totalCost - a.totalCost);

    res.json({ success: true, data: {
      period: { startDate, endDate },
      summary: {
        totalVehicles:        results.length,
        totalFuelL:           results.reduce((s, v) => s + v.totalFuelL,           0),
        totalFuelCost:        results.reduce((s, v) => s + v.totalFuelCost,        0),
        totalMaintenanceCost: results.reduce((s, v) => s + v.totalMaintenanceCost, 0),
      },
      vehicles: results,
    }});
  } catch (e) {
    console.error("❌ GET /reports/vehicles/activity:", e);
    next(e);
  }
});

// ============================================================
// MAINTENANCE : ENTRETIENS RÉALISÉS
// GET /api/reports/maintenance/done
// ============================================================
router.get("/maintenance/done", auth(ADMIN_ROLES), async (req, res, next) => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const maintenances = await prisma.maintenance.findMany({
      where: { doneAt: { gte: startDate, lte: endDate } },
      include: { vehicle: { select: { id: true, plate: true, make: true, model: true } } },
      orderBy: { doneAt: "desc" },
    });

    const byType = {};
    for (const m of maintenances) {
      if (!byType[m.maintenanceType]) byType[m.maintenanceType] = { type: m.maintenanceType, count: 0, totalCost: 0 };
      byType[m.maintenanceType].count++;
      byType[m.maintenanceType].totalCost += m.cost || 0;
    }

    const byVehicle = {};
    for (const m of maintenances) {
      const key = m.vehicle?.plate || m.vehicleId || "Inconnu";
      if (!byVehicle[key]) byVehicle[key] = { vehicle: key, count: 0, totalCost: 0 };
      byVehicle[key].count++;
      byVehicle[key].totalCost += m.cost || 0;
    }

    res.json({ success: true, data: {
      period: { startDate, endDate },
      summary: { count: maintenances.length, totalCost: maintenances.reduce((s, m) => s + (m.cost || 0), 0) },
      byType:    Object.values(byType),
      byVehicle: Object.values(byVehicle).sort((a, b) => b.totalCost - a.totalCost),
      lines: maintenances.map(m => ({
        id: m.id, date: m.doneAt,
        vehicle:      m.vehicle?.plate || "-",
        vehicleLabel: `${m.vehicle?.make || ""} ${m.vehicle?.model || ""}`.trim(),
        type:         m.maintenanceType,
        description:  m.description,
        odometerKm:   m.odometerKm,
        cost:         m.cost,
        status:       m.status,
      })),
    }});
  } catch (e) {
    console.error("❌ GET /reports/maintenance/done:", e);
    next(e);
  }
});

// ============================================================
// MAINTENANCE : ENTRETIENS À VENIR
// GET /api/reports/maintenance/upcoming
// ============================================================
router.get("/maintenance/upcoming", auth(ADMIN_ROLES), async (req, res, next) => {
  try {
    const now        = new Date();
    const daysAhead  = parseInt(req.query.days) || 60;
    const futureDate = new Date(now.getTime() + daysAhead * 86400000);

    const maintenances = await prisma.maintenance.findMany({
      where: { doneAt: null, dueAt: { not: null, lte: futureDate } },
      include: { vehicle: { select: { id: true, plate: true, make: true, model: true, odometerKm: true } } },
      orderBy: { dueAt: "asc" },
    });

    const now_ts = now.getTime();
    const lines  = maintenances.map(m => {
      const daysLeft = m.dueAt ? Math.round((new Date(m.dueAt).getTime() - now_ts) / 86400000) : null;
      const urgency  = daysLeft === null ? "normal" : daysLeft < 0 ? "overdue" : daysLeft <= 7 ? "urgent" : daysLeft <= 30 ? "soon" : "normal";
      return {
        id: m.id,
        vehicle:       m.vehicle?.plate || "-",
        vehicleLabel:  `${m.vehicle?.make || ""} ${m.vehicle?.model || ""}`.trim(),
        odometerKm:    m.vehicle?.odometerKm,
        type:          m.maintenanceType,
        description:   m.description,
        dueAt:         m.dueAt,
        daysLeft, urgency,
        estimatedCost: m.cost,
      };
    });

    res.json({ success: true, data: {
      daysAhead,
      summary: {
        total:   lines.length,
        overdue: lines.filter(l => l.urgency === "overdue").length,
        urgent:  lines.filter(l => l.urgency === "urgent").length,
        soon:    lines.filter(l => l.urgency === "soon").length,
        normal:  lines.filter(l => l.urgency === "normal").length,
      },
      lines,
    }});
  } catch (e) {
    console.error("❌ GET /reports/maintenance/upcoming:", e);
    next(e);
  }
});

// ============================================================
// MAINTENANCE : ALERTES TECHNIQUES
// GET /api/reports/maintenance/alerts
// ============================================================
router.get("/maintenance/alerts", auth(ADMIN_ROLES), async (req, res, next) => {
  try {
    const now       = new Date();
    const alertDays = parseInt(req.query.days) || 30;
    const alertDate = new Date(now.getTime() + alertDays * 86400000);
    const now_ts    = now.getTime();

    const [inspections, insurances, overdueMaintenances] = await Promise.all([
      prisma.inspection.findMany({
        where: { OR: [
          { nextInspect: { lte: alertDate } },
          { scheduledAt: { not: null, lte: alertDate, gte: now } },
        ]},
        include: { vehicle: { select: { id: true, plate: true, make: true, model: true } } },
      }),
      prisma.insurancePolicy.findMany({
        where: { endAt: { not: null, lte: alertDate } },
        include: {
          vehicle: { select: { id: true, plate: true, make: true, model: true } },
          insurer: { select: { name: true } },
        },
      }),
      prisma.maintenance.findMany({
        where: { doneAt: null, dueAt: { not: null, lt: now } },
        include: { vehicle: { select: { id: true, plate: true, make: true, model: true } } },
      }),
    ]);

    const alerts = [
      ...inspections.map(i => {
        const refDate  = i.nextInspect || i.scheduledAt;
        const daysLeft = refDate ? Math.round((new Date(refDate).getTime() - now_ts) / 86400000) : null;
        return {
          type: "inspection",
          vehiclePlate: i.vehicle?.plate || "-",
          vehicleLabel: `${i.vehicle?.make || ""} ${i.vehicle?.model || ""}`.trim(),
          label:    `Inspection : ${i.type}`,
          dueDate:  refDate, daysLeft,
          status:   daysLeft !== null && daysLeft < 0 ? "expired" : (daysLeft !== null && daysLeft <= 7 ? "urgent" : "warning"),
        };
      }),
      ...insurances.map(ins => {
        const daysLeft = ins.endAt ? Math.round((new Date(ins.endAt).getTime() - now_ts) / 86400000) : null;
        return {
          type: "insurance",
          vehiclePlate: ins.vehicle?.plate || "-",
          vehicleLabel: `${ins.vehicle?.make || ""} ${ins.vehicle?.model || ""}`.trim(),
          label:    `Assurance ${ins.insurancesType} — ${ins.insurer?.name || "-"}`,
          dueDate:  ins.endAt, daysLeft,
          status:   daysLeft !== null && daysLeft < 0 ? "expired" : (daysLeft !== null && daysLeft <= 7 ? "urgent" : "warning"),
        };
      }),
      ...overdueMaintenances.map(m => ({
        type: "maintenance",
        vehiclePlate: m.vehicle?.plate || "-",
        vehicleLabel: `${m.vehicle?.make || ""} ${m.vehicle?.model || ""}`.trim(),
        label:    `Maintenance : ${m.maintenanceType}`,
        dueDate:  m.dueAt,
        daysLeft: m.dueAt ? Math.round((new Date(m.dueAt).getTime() - now_ts) / 86400000) : null,
        status:   "overdue",
      })),
    ].sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

    res.json({ success: true, data: {
      alertDays,
      summary: {
        total:   alerts.length,
        expired: alerts.filter(a => a.status === "expired").length,
        overdue: alerts.filter(a => a.status === "overdue").length,
        urgent:  alerts.filter(a => a.status === "urgent").length,
        warning: alerts.filter(a => a.status === "warning").length,
      },
      alerts,
    }});
  } catch (e) {
    console.error("❌ GET /reports/maintenance/alerts:", e);
    next(e);
  }
});

// ============================================================
// AUDIT : ANOMALIES DÉTECTÉES (surconsommation / fraudes)
// GET /api/reports/audit/anomalies
// ============================================================
router.get("/audit/anomalies", auth(ALL_ROLES), async (req, res, next) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const stationIds   = await getStationScope(req.user);
    const normL100km   = parseFloat(req.query.norm)      || 12;
    const thresholdPct = parseFloat(req.query.threshold) || 10;

    const where = { dispensedAt: { gte: startDate, lte: endDate }, vehicleId: { not: null } };
    if (stationIds) where.stationId = { in: stationIds };

    const dispenses = await prisma.fuelDispense.findMany({
      where,
      include: {
        vehicle: { select: { id: true, plate: true, make: true, model: true, category: true } },
        driver:  { select: { id: true, fullName: true } },
        station: { select: { id: true, name: true } },
      },
      orderBy: [{ vehicleId: "asc" }, { dispensedAt: "asc" }],
    });

    const vehicleMap = {};
    for (const d of dispenses) {
      const vid = d.vehicleId;
      if (!vehicleMap[vid]) {
        vehicleMap[vid] = {
          vehicleId: vid, plate: d.vehicle?.plate || vid,
          make: d.vehicle?.make || "", model: d.vehicle?.model || "",
          category: d.vehicle?.category || null,
          totalL: 0, count: 0,
          odometerFirst: d.odometerKm || 0, odometerLast: d.odometerKm || 0,
        };
      }
      vehicleMap[vid].totalL += d.liters;
      vehicleMap[vid].count++;
      if (d.odometerKm > vehicleMap[vid].odometerLast) vehicleMap[vid].odometerLast = d.odometerKm;
      if (d.odometerKm < vehicleMap[vid].odometerFirst && d.odometerKm > 0) vehicleMap[vid].odometerFirst = d.odometerKm;
    }

    const anomalies = [];
    for (const v of Object.values(vehicleMap)) {
      const kmDriven = v.odometerLast - v.odometerFirst;
      if (kmDriven <= 0) continue;
      const vehicleNorm = v.category ? (CATEGORY_NORMS[v.category] ?? normL100km) : normL100km;
      const actualRate = (v.totalL / kmDriven) * 100;
      const normL      = (vehicleNorm / 100) * kmDriven;
      const ecartPct   = normL > 0 ? ((v.totalL - normL) / normL) * 100 : null;
      if (ecartPct !== null && Math.abs(ecartPct) >= thresholdPct) {
        anomalies.push({
          plate: v.plate, vehicleLabel: `${v.make} ${v.model}`.trim(),
          category: v.category,
          totalL: v.totalL, kmDriven,
          actualRate: Math.round(actualRate * 100) / 100,
          normRate: vehicleNorm,
          ecartPct:  Math.round(ecartPct * 10) / 10,
          severity:  Math.abs(ecartPct) > 25 ? "critical" : "warning",
          fillCount: v.count,
        });
      }
    }
    anomalies.sort((a, b) => Math.abs(b.ecartPct) - Math.abs(a.ecartPct));

    res.json({ success: true, data: {
      period: { startDate, endDate },
      normL100km, thresholdPct,
      categoryNorms: CATEGORY_NORMS,
      summary: {
        total:    anomalies.length,
        critical: anomalies.filter(a => a.severity === "critical").length,
        warning:  anomalies.filter(a => a.severity === "warning").length,
      },
      anomalies,
    }});
  } catch (e) {
    console.error("❌ GET /reports/audit/anomalies:", e);
    next(e);
  }
});

// ============================================================
// AUDIT : RAPPROCHEMENT STOCK (théorique vs réel)
// GET /api/reports/audit/stock
// ============================================================
router.get("/audit/stock", auth(ALL_ROLES), async (req, res, next) => {
  try {
    const stationIds = await getStationScope(req.user);
    const tanks = await prisma.tank.findMany({
      where: stationIds ? { stationId: { in: stationIds } } : {},
      include: {
        station:  { select: { id: true, name: true } },
        supplies: { select: { deliveredL: true } },
        dispenses: { select: { liters: true } },
      },
    });

    const lines = tanks.map(t => {
      const totalIn  = t.supplies.reduce((s, x) => s + x.deliveredL, 0);
      const totalOut = t.dispenses.reduce((s, x) => s + x.liters, 0);
      // Le stock théorique (système) est currentL — maintenu transactionnellement
      // totalIn - totalOut est fourni à titre informatif mais ne reflète pas le stock réel
      // car il ignore le stock initial et les rapprochements validés.
      const theoreticalL = t.currentL;
      // Écart entre stock théorique et mouvement cumulé (peut indiquer des ajustements manuels)
      const cumulativeL  = totalIn - totalOut;
      const ecartL       = theoreticalL - cumulativeL;
      const ecartPct     = cumulativeL > 0 ? (ecartL / cumulativeL) * 100 : null;
      const status       = ecartPct === null ? "ok" : Math.abs(ecartPct) > 10 ? "critical" : Math.abs(ecartPct) > 5 ? "warning" : "ok";
      return {
        tankId: t.id, tankName: t.name,
        station: t.station?.name || "-", fuelType: t.fuelType,
        capacityL: t.capacityL, currentL: t.currentL, theoreticalL,
        totalIn, totalOut, cumulativeL,
        ecartL, ecartPct: ecartPct !== null ? Math.round(ecartPct * 100) / 100 : null,
        fillPct: t.capacityL > 0 ? Math.round((t.currentL / t.capacityL) * 100) : 0,
        lowAlert: t.currentL <= t.lowAlertL, status,
      };
    });

    res.json({ success: true, data: {
      summary: {
        totalTanks: lines.length,
        critical:   lines.filter(l => l.status === "critical").length,
        warnings:   lines.filter(l => l.status === "warning").length,
        lowAlerts:  lines.filter(l => l.lowAlert).length,
      },
      tanks: lines,
    }});
  } catch (e) {
    console.error("❌ GET /reports/audit/stock:", e);
    next(e);
  }
});

// ============================================================
// AUDIT : RAPPORT JOURNALIER DE STATION
// GET /api/reports/audit/daily
// ============================================================
router.get("/audit/daily", auth(ALL_ROLES), async (req, res, next) => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const dayStart   = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd     = new Date(targetDate); dayEnd.setHours(23, 59, 59, 999);

    const stationIds = await getStationScope(req.user);
    const stationFilter = stationIds ? { stationId: { in: stationIds } } : {};

    const [dispenses, supplies] = await Promise.all([
      prisma.fuelDispense.findMany({
        where: { ...stationFilter, dispensedAt: { gte: dayStart, lte: dayEnd } },
        include: {
          vehicle: { select: { id: true, plate: true } },
          driver:  { select: { id: true, fullName: true } },
          station: { select: { id: true, name: true } },
          tank:    { select: { id: true, name: true, fuelType: true } },
        },
        orderBy: { dispensedAt: "asc" },
      }),
      prisma.fuelSupply.findMany({
        where: { ...stationFilter, deliveredAt: { gte: dayStart, lte: dayEnd } },
        include: {
          station: { select: { id: true, name: true } },
          tank:    { select: { id: true, name: true, fuelType: true } },
        },
        orderBy: { deliveredAt: "asc" },
      }),
    ]);

    const byStation = {};
    for (const d of dispenses) {
      const sId = d.stationId;
      if (!byStation[sId]) byStation[sId] = { stationId: sId, name: d.station?.name || sId, dispensesL: 0, dispensesCost: 0, dispenseCount: 0, suppliesL: 0, suppliesCost: 0, supplyCount: 0 };
      byStation[sId].dispensesL    += d.liters;
      byStation[sId].dispensesCost += d.liters * (d.unitPrice || 0);
      byStation[sId].dispenseCount++;
    }
    for (const s of supplies) {
      const sId = s.stationId;
      if (!byStation[sId]) byStation[sId] = { stationId: sId, name: s.station?.name || sId, dispensesL: 0, dispensesCost: 0, dispenseCount: 0, suppliesL: 0, suppliesCost: 0, supplyCount: 0 };
      byStation[sId].suppliesL    += s.deliveredL;
      byStation[sId].suppliesCost += s.deliveredL * (s.unitPrice || 0);
      byStation[sId].supplyCount++;
    }

    res.json({ success: true, data: {
      date: targetDate,
      summary: {
        totalDispensesL:    dispenses.reduce((s, d) => s + d.liters, 0),
        totalDispensesCost: dispenses.reduce((s, d) => s + d.liters * (d.unitPrice || 0), 0),
        totalDispensesCount: dispenses.length,
        totalSuppliesL:     supplies.reduce((s, x) => s + x.deliveredL, 0),
        totalSuppliesCost:  supplies.reduce((s, x) => s + x.deliveredL * (x.unitPrice || 0), 0),
        totalSuppliesCount: supplies.length,
      },
      byStation: Object.values(byStation),
      dispenses: dispenses.map(d => ({
        id: d.id, time: d.dispensedAt,
        station:  d.station?.name || "-",
        tank:     d.tank?.name    || "-",
        fuelType: d.tank?.fuelType || "-",
        vehicle:  d.vehicleId ? d.vehicle?.plate : (d.privatePlate || "Privé"),
        driver:   d.driver?.fullName || "-",
        liters:   d.liters, unitPrice: d.unitPrice,
        cost:     d.liters * (d.unitPrice || 0),
      })),
      supplies: supplies.map(s => ({
        id: s.id, time: s.deliveredAt,
        station:     s.station?.name || "-",
        tank:        s.tank?.name    || "-",
        fuelType:    s.tank?.fuelType || "-",
        supplier:    s.supplier || "-",
        deliveredL:  s.deliveredL, unitPrice: s.unitPrice,
        cost:        s.deliveredL * (s.unitPrice || 0),
        deliveryRef: s.deliveryRef,
      })),
    }});
  } catch (e) {
    console.error("❌ GET /reports/audit/daily:", e);
    next(e);
  }
});

// ============================================================
// SYNTHÈSE : TABLEAU DE BORD MENSUEL
// GET /api/reports/summary/monthly
// ============================================================
router.get("/summary/monthly", auth(ADMIN_ROLES), async (req, res, next) => {
  try {
    const year      = parseInt(req.query.year)  || new Date().getFullYear();
    const month     = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59, 999);

    const [dispenses, supplies, maintenances, vehicles, alertIns, alertInsp] = await Promise.all([
      prisma.fuelDispense.findMany({
        where: { dispensedAt: { gte: startDate, lte: endDate } },
        select: { liters: true, unitPrice: true, vehicleId: true, stationId: true },
      }),
      prisma.fuelSupply.findMany({
        where: { deliveredAt: { gte: startDate, lte: endDate } },
        select: { deliveredL: true, unitPrice: true },
      }),
      prisma.maintenance.findMany({
        where: { doneAt: { gte: startDate, lte: endDate } },
        select: { cost: true, maintenanceType: true },
      }),
      prisma.vehicle.findMany({ select: { id: true, status: true } }),
      prisma.insurancePolicy.findMany({
        where: { endAt: { lte: new Date(endDate.getTime() + 30 * 86400000) } },
        select: { id: true },
      }),
      prisma.inspection.findMany({
        where: { nextInspect: { lte: new Date(endDate.getTime() + 30 * 86400000) } },
        select: { id: true },
      }),
    ]);

    const totalFuelL           = dispenses.reduce((s, d) => s + d.liters, 0);
    const totalFuelCost        = dispenses.reduce((s, d) => s + d.liters * (d.unitPrice || 0), 0);
    const totalMaintenanceCost = maintenances.reduce((s, m) => s + (m.cost || 0), 0);

    const maintenanceByType = maintenances.reduce((acc, m) => {
      acc[m.maintenanceType] = (acc[m.maintenanceType] || 0) + 1;
      return acc;
    }, {});

    res.json({ success: true, data: {
      period: { year, month, startDate, endDate },
      fuel: {
        dispensesL:       totalFuelL,
        dispensesCost:    totalFuelCost,
        suppliesL:        supplies.reduce((s, x) => s + x.deliveredL, 0),
        transactions:     dispenses.length,
        avgPerTransaction: dispenses.length > 0 ? Math.round(totalFuelL / dispenses.length) : 0,
      },
      maintenance: {
        operations: maintenances.length,
        totalCost:  totalMaintenanceCost,
        byType:     maintenanceByType,
      },
      fleet: {
        total:        vehicles.length,
        active:       vehicles.filter(v => v.status === "EN_SERVICE").length,
        inRepair:     vehicles.filter(v => v.status === "EN_REPARATION").length,
        outOfService: vehicles.filter(v => v.status === "HORS_SERVICE").length,
      },
      alerts: {
        insurancesExpiringSoon: alertIns.length,
        inspectionsDueSoon:     alertInsp.length,
      },
      totalOperationalCost: totalFuelCost + totalMaintenanceCost,
    }});
  } catch (e) {
    console.error("❌ GET /reports/summary/monthly:", e);
    next(e);
  }
});

// ============================================================
// SYNTHÈSE : RAPPORT GLOBAL DE GESTION DE FLOTTE
// GET /api/reports/summary/fleet
// ============================================================
router.get("/summary/fleet", auth(ADMIN_ROLES), async (req, res, next) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const now = new Date();

    const [vehicles, drivers, stations, dispenses, supplies, maintenances, inspAlerts, insAlerts] = await Promise.all([
      prisma.vehicle.findMany({
        select: { id: true, plate: true, make: true, model: true, fuelType: true, status: true, odometerKm: true },
      }),
      prisma.driver.findMany({ select: { id: true } }),
      prisma.station.findMany({ select: { id: true, name: true, tanks: { select: { currentL: true, capacityL: true } } } }),
      prisma.fuelDispense.findMany({
        where: { dispensedAt: { gte: startDate, lte: endDate } },
        select: { liters: true, unitPrice: true, vehicleId: true },
      }),
      prisma.fuelSupply.findMany({
        where: { deliveredAt: { gte: startDate, lte: endDate } },
        select: { deliveredL: true, unitPrice: true },
      }),
      prisma.maintenance.findMany({
        where: { doneAt: { gte: startDate, lte: endDate } },
        select: { cost: true },
      }),
      prisma.inspection.findMany({
        where: { nextInspect: { lte: new Date(now.getTime() + 30 * 86400000) } },
        select: { id: true },
      }),
      prisma.insurancePolicy.findMany({
        where: { endAt: { lte: new Date(now.getTime() + 30 * 86400000) } },
        select: { id: true },
      }),
    ]);

    const vehicleFuelMap = {};
    for (const d of dispenses) {
      if (!d.vehicleId) continue;
      if (!vehicleFuelMap[d.vehicleId]) vehicleFuelMap[d.vehicleId] = { totalL: 0, totalCost: 0 };
      vehicleFuelMap[d.vehicleId].totalL    += d.liters;
      vehicleFuelMap[d.vehicleId].totalCost += d.liters * (d.unitPrice || 0);
    }

    const totalFuelL           = dispenses.reduce((s, d) => s + d.liters, 0);
    const totalFuelCost        = dispenses.reduce((s, d) => s + d.liters * (d.unitPrice || 0), 0);
    const totalMaintenanceCost = maintenances.reduce((s, m) => s + (m.cost || 0), 0);

    res.json({ success: true, data: {
      period: { startDate, endDate },
      fleet: {
        totalVehicles: vehicles.length,
        active:        vehicles.filter(v => v.status === "EN_SERVICE").length,
        inRepair:      vehicles.filter(v => v.status === "EN_REPARATION").length,
        outOfService:  vehicles.filter(v => v.status === "HORS_SERVICE").length,
        totalDrivers:  drivers.length,
        totalStations: stations.length,
      },
      fuel: {
        totalL:      totalFuelL,
        totalCost:   totalFuelCost,
        suppliesL:   supplies.reduce((s, x) => s + x.deliveredL, 0),
        suppliesCost: supplies.reduce((s, x) => s + x.deliveredL * (x.unitPrice || 0), 0),
      },
      maintenance: { operations: maintenances.length, totalCost: totalMaintenanceCost },
      alerts: { inspections: inspAlerts.length, insurances: insAlerts.length },
      totalCost: totalFuelCost + totalMaintenanceCost,
      vehicles: vehicles.map(v => ({
        id: v.id, plate: v.plate,
        label:     `${v.make || ""} ${v.model || ""}`.trim(),
        fuelType:  v.fuelType, status: v.status, odometerKm: v.odometerKm,
        fuelL:     vehicleFuelMap[v.id]?.totalL    || 0,
        fuelCost:  vehicleFuelMap[v.id]?.totalCost || 0,
      })).sort((a, b) => b.fuelCost - a.fuelCost),
    }});
  } catch (e) {
    console.error("❌ GET /reports/summary/fleet:", e);
    next(e);
  }
});

export default router;
