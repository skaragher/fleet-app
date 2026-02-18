import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/", auth(), async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    // 1. Exécution parallèle de toutes les requêtes
    const [
      vehiclesCount, 
      stationsCount, 
      maintPlannedCount, 
      vtUpcomingCount,
      insuranceActiveCount,
      insuranceExpiringCount,
      insuranceExpiredCount,
      insurancePremiumSum,
      tanks,
      maintenances,  // Pour la liste des alertes maintenance
      insurances,    // Pour la liste des assurances
      inspections,   // Pour la liste des visites techniques
      vehicles       // Pour l'analyse de consommation
    ] = await Promise.all([
      prisma.vehicle.count(),
      prisma.station.count(),
      prisma.maintenance.count({ where: { status: "PLANNED" }}),
      prisma.inspection.count({
        where: {
          OR: [
            { doneAt: null },
            { nextInspect: { not: null } }
          ]
        }
      }),
      prisma.insurancePolicy.count({
        where: {
          endAt: { gte: today },
          OR: [{ startAt: null }, { startAt: { lte: today } }]
        }
      }),
      prisma.insurancePolicy.count({
        where: {
          endAt: { gte: today, lte: in30Days }
        }
      }),
      prisma.insurancePolicy.count({
        where: {
          endAt: { lt: today }
        }
      }),
      prisma.insurancePolicy.aggregate({
        _sum: { premium: true },
        where: {
          endAt: { gte: today },
          OR: [{ startAt: null }, { startAt: { lte: today } }]
        }
      }),
      prisma.tank.findMany({ include: { station: true }, orderBy: { updatedAt: "desc" } }),
      prisma.maintenance.findMany({ 
        where: { status: "PLANNED" }, 
        include: { vehicle: true }, 
        orderBy: { dueAt: 'asc' } 
      }),
      prisma.insurancePolicy.findMany({ 
        include: { vehicle: true, insurer: true }, 
        orderBy: { endAt: 'asc' } 
      }),
      prisma.inspection.findMany({
        where: {
          OR: [
            { doneAt: null },
            { nextInspect: { not: null } }
          ]
        },
        include: { vehicle: true },
        orderBy: [
          { nextInspect: 'asc' },
          { scheduledAt: 'asc' }
        ]
      }),
      prisma.vehicle.findMany({
        include: { fuelDispenses: { include: { station: true }, orderBy: { odometerKm: 'asc' } } }
      })
    ]);

    // 2. Calcul de la Flotte & Consommation
    const fleet = vehicles.map(v => {
      const dispenses = v.fuelDispenses || [];
      let globalAvg = 0;
      const monthlyValues = Array.from({ length: 12 }, () => ({ liters: 0, km: 0 }));

      if (dispenses.length >= 2) {
        const totalDist = dispenses[dispenses.length - 1].odometerKm - dispenses[0].odometerKm;
        const totalLiters = dispenses.slice(1).reduce((acc, d) => acc + d.liters, 0);
        if (totalDist > 0) globalAvg = (totalLiters / totalDist) * 100;

        for (let i = 1; i < dispenses.length; i++) {
          const current = dispenses[i];
          const prev = dispenses[i - 1];
          const month = new Date(current.dispensedAt).getMonth();
          const dist = current.odometerKm - prev.odometerKm;
          if (dist > 0) {
            monthlyValues[month].liters += current.liters;
            monthlyValues[month].km += dist;
          }
        }
      }

      return {
        id: v.id,
        model: v.model || "N/A",
        plate: v.plate,
        totalKm: v.odometerKm,
        avgConsumption: globalAvg.toFixed(2),
        monthlyStats: {
          labels: ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"],
          values: monthlyValues.map(m => m.km > 0 ? parseFloat(((m.liters / m.km) * 100).toFixed(2)) : 0)
        },
        history: dispenses.map(d => ({
          id: d.id,
          date: d.dispensedAt,
          liters: d.liters,
          odometer: d.odometerKm,
          station: d.station?.name || "N/A"
        })).reverse()
      };
    });

    // 3. Coûts de Maintenance Terminée (Graphique)
    const doneMaintenances = await prisma.maintenance.findMany({
      where: { status: "DONE" },
      include: { vehicle: { select: { plate: true } } },
      take: 10
    });

    res.json({
      kpis: {
        vehicles: vehiclesCount,
        stations: stationsCount,
        maintPlanned: maintPlannedCount,
        vtUpcoming: vtUpcomingCount,
        insuranceActive: insuranceActiveCount,
        insuranceExpiring30: insuranceExpiringCount,
        insuranceExpired: insuranceExpiredCount,
        insuranceTotalPremium: insurancePremiumSum?._sum?.premium || 0
      },
      tanks,
      fleet,
      maintenances, // Liste brute des maintenances PLANNED
      insurances,   // Liste brute des polices d'assurance
      inspections,  // Liste brute des inspections non faites
      consumption: {
        labels: fleet.slice(0, 10).map(f => f.plate),
        values: fleet.slice(0, 10).map(f => parseFloat(f.avgConsumption))
      },
      maintenanceChart: {
        labels: doneMaintenances.map(m => m.vehicle?.plate || "N/A"),
        values: doneMaintenances.map(m => m.cost || 0)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
