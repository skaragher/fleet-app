import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { buildUserScope } from "../utils/userScope.js";

const router = Router();

const ADMIN_ROLES  = ["SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"];
const MANAGE_ROLES = ["SUPER_ADMIN", "ADMIN", "FLEET_MANAGER", "STATION_MANAGER", "FUEL_MANAGER"];

// ─── Utilitaire : scope stations de l'utilisateur ───────────────────────────
async function getStationScope(user) {
  const scope = await buildUserScope(user);
  if (scope.role === "STATION_MANAGER") {
    return scope.assignedStationIds?.length ? scope.assignedStationIds : ["__none__"];
  }
  return null; // null = accès total
}

// ─── Utilitaire : journaliser dans StockAuditLog ────────────────────────────
export async function logStockAction({ tankId, stationId, action, userId, userName, previousL, newL, relatedId, relatedType, notes }) {
  try {
    await prisma.stockAuditLog.create({
      data: {
        tankId,
        stationId,
        action,
        userId: userId || null,
        userName: userName || null,
        previousL,
        newL,
        deltaL: newL - previousL,
        relatedId: relatedId || null,
        relatedType: relatedType || null,
        notes: notes || null,
      },
    });
  } catch (e) {
    console.error("⚠️ logStockAction failed (non-blocking):", e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/reconciliations - liste des rapprochements
// ══════════════════════════════════════════════════════════════════════════════
router.get("/", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    const stationIds = await getStationScope(req.user);
    const { stationId, tankId, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};
    if (stationIds)   where.stationId = { in: stationIds };
    if (stationId)    where.stationId = stationId;
    if (tankId)       where.tankId    = tankId;
    if (status)       where.status    = status;
    if (startDate || endDate) {
      where.performedAt = {};
      if (startDate) where.performedAt.gte = new Date(startDate);
      if (endDate)   { const e = new Date(endDate); e.setHours(23,59,59,999); where.performedAt.lte = e; }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      prisma.stockReconciliation.findMany({
        where,
        include: {
          tank:      { select: { id: true, name: true, fuelType: true, capacityL: true, currentL: true } },
          station:   { select: { id: true, name: true } },
          performer: { select: { id: true, name: true, email: true, role: true } },
          validator: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { performedAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.stockReconciliation.count({ where }),
    ]);

    res.json({ success: true, data: items, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    console.error("❌ GET /reconciliations:", e);
    next(e);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/reconciliations/audit - journal des opérations stock
// ══════════════════════════════════════════════════════════════════════════════
router.get("/audit", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    const stationIds = await getStationScope(req.user);
    const { stationId, tankId, action, userId, startDate, endDate, page = 1, limit = 100 } = req.query;

    const where = {};
    if (stationIds)   where.stationId = { in: stationIds };
    if (stationId)    where.stationId = stationId;
    if (tankId)       where.tankId    = tankId;
    if (action)       where.action    = action;
    if (userId)       where.userId    = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate)   { const e = new Date(endDate); e.setHours(23,59,59,999); where.createdAt.lte = e; }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      prisma.stockAuditLog.findMany({
        where,
        include: {
          tank:    { select: { id: true, name: true, fuelType: true } },
          station: { select: { id: true, name: true } },
          user:    { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.stockAuditLog.count({ where }),
    ]);

    res.json({ success: true, data: items, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    console.error("❌ GET /reconciliations/audit:", e);
    next(e);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/reconciliations - créer un rapprochement
// ══════════════════════════════════════════════════════════════════════════════
router.post("/", auth(MANAGE_ROLES), async (req, res, next) => {
  try {
    const { tankId, physicalL, reason, notes } = req.body;

    if (!tankId || physicalL === undefined || physicalL === null) {
      return res.status(400).json({ success: false, message: "tankId et physicalL sont requis" });
    }
    if (Number(physicalL) < 0) {
      return res.status(400).json({ success: false, message: "Le stock physique ne peut pas être négatif" });
    }

    const tank = await prisma.tank.findUnique({
      where: { id: tankId },
      include: { station: { select: { id: true, name: true } } },
    });
    if (!tank) return res.status(404).json({ success: false, message: "Cuve introuvable" });

    // Vérifier l'accès station pour STATION_MANAGER
    const stationIds = await getStationScope(req.user);
    if (stationIds && !stationIds.includes(tank.stationId)) {
      return res.status(403).json({ success: false, message: "Accès refusé à cette station" });
    }

    const physicalLInt  = Math.round(Number(physicalL));
    const adjustmentL   = physicalLInt - tank.currentL;

    // Créer le rapprochement + mettre à jour le stock dans une transaction
    const recon = await prisma.$transaction(async (tx) => {
      const newRecon = await tx.stockReconciliation.create({
        data: {
          tankId,
          stationId:   tank.stationId,
          systemL:     tank.currentL,
          physicalL:   physicalLInt,
          adjustmentL,
          reason:      reason || null,
          notes:       notes  || null,
          status:      "PENDING",
          performedBy: req.user.userId,
          performedAt: new Date(),
        },
        include: {
          tank:      { select: { id: true, name: true, fuelType: true } },
          station:   { select: { id: true, name: true } },
          performer: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      // Trace dans l'audit
      await tx.stockAuditLog.create({
        data: {
          tankId,
          stationId:   tank.stationId,
          action:      "RECONCILIATION",
          userId:      req.user.userId,
          userName:    req.user.name || req.user.email || null,
          previousL:   tank.currentL,
          newL:        tank.currentL, // pas encore appliqué (PENDING)
          deltaL:      0,
          relatedId:   newRecon.id,
          relatedType: "reconciliation",
          notes:       `Rapprochement créé - stock système: ${tank.currentL}L, stock physique: ${physicalLInt}L, écart: ${adjustmentL > 0 ? "+" : ""}${adjustmentL}L`,
        },
      });

      return newRecon;
    });

    res.status(201).json({ success: true, data: recon, message: "Rapprochement créé, en attente de validation" });
  } catch (e) {
    console.error("❌ POST /reconciliations:", e);
    next(e);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/reconciliations/:id/validate - valider ou rejeter
// ══════════════════════════════════════════════════════════════════════════════
router.put("/:id/validate", auth(ADMIN_ROLES), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: "VALIDATED" | "REJECTED"

    if (!["VALIDATED", "REJECTED"].includes(action)) {
      return res.status(400).json({ success: false, message: "action doit être VALIDATED ou REJECTED" });
    }

    const recon = await prisma.stockReconciliation.findUnique({
      where: { id },
      include: { tank: true },
    });
    if (!recon) return res.status(404).json({ success: false, message: "Rapprochement introuvable" });
    if (recon.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Rapprochement déjà ${recon.status}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.stockReconciliation.update({
        where: { id },
        data: {
          status:      action,
          validatedBy: req.user.userId,
          validatedAt: new Date(),
          notes:       notes ? `${recon.notes ? recon.notes + "\n" : ""}[Validation] ${notes}` : recon.notes,
        },
        include: {
          tank:      { select: { id: true, name: true, fuelType: true } },
          station:   { select: { id: true, name: true } },
          performer: { select: { id: true, name: true, role: true } },
          validator: { select: { id: true, name: true, role: true } },
        },
      });

      if (action === "VALIDATED") {
        // Appliquer l'ajustement au stock réel
        await tx.tank.update({
          where: { id: recon.tankId },
          data:  { currentL: recon.physicalL },
        });

        await tx.stockAuditLog.create({
          data: {
            tankId:      recon.tankId,
            stationId:   recon.stationId,
            action:      "RECONCILIATION",
            userId:      req.user.userId,
            userName:    req.user.name || req.user.email || null,
            previousL:   recon.systemL,
            newL:        recon.physicalL,
            deltaL:      recon.adjustmentL,
            relatedId:   id,
            relatedType: "reconciliation",
            notes:       `Rapprochement VALIDÉ - stock ajusté de ${recon.systemL}L à ${recon.physicalL}L (${recon.adjustmentL > 0 ? "+" : ""}${recon.adjustmentL}L)`,
          },
        });
      } else {
        // Rejet - trace seulement
        await tx.stockAuditLog.create({
          data: {
            tankId:      recon.tankId,
            stationId:   recon.stationId,
            action:      "RECONCILIATION",
            userId:      req.user.userId,
            userName:    req.user.name || req.user.email || null,
            previousL:   recon.systemL,
            newL:        recon.systemL,
            deltaL:      0,
            relatedId:   id,
            relatedType: "reconciliation",
            notes:       `Rapprochement REJETÉ - stock inchangé`,
          },
        });
      }

      return result;
    });

    res.json({ success: true, data: updated, message: action === "VALIDATED" ? "Rapprochement validé et stock mis à jour" : "Rapprochement rejeté" });
  } catch (e) {
    console.error("❌ PUT /reconciliations/:id/validate:", e);
    next(e);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/reconciliations/:id - supprimer (PENDING uniquement)
// ══════════════════════════════════════════════════════════════════════════════
router.delete("/:id", auth(ADMIN_ROLES), async (req, res, next) => {
  try {
    const { id } = req.params;
    const recon = await prisma.stockReconciliation.findUnique({ where: { id } });
    if (!recon) return res.status(404).json({ success: false, message: "Rapprochement introuvable" });
    if (recon.status !== "PENDING") {
      return res.status(400).json({ success: false, message: "Seuls les rapprochements en attente peuvent être supprimés" });
    }

    await prisma.stockReconciliation.delete({ where: { id } });
    res.json({ success: true, message: "Rapprochement supprimé" });
  } catch (e) {
    console.error("❌ DELETE /reconciliations/:id:", e);
    next(e);
  }
});

export default router;
