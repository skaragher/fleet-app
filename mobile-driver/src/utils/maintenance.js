export const DONE_STATUSES = ["DONE", "COMPLETED", "CANCELLED"];

export const normalizeStatus = (status) => String(status || "").toUpperCase().trim();

export const isPendingMaintenance = (m) => !DONE_STATUSES.includes(normalizeStatus(m?.status));

export const maintenanceTypeLabel = (type) => {
  const t = String(type || "").toUpperCase();
  if (t === "VIDANGE") return "Vidange";
  if (t === "REVISION") return "Revision";
  if (t === "REPARATION") return "Reparation";
  if (t === "DEPANNAGE") return "Depannage";
  return type || "Entretien";
};

export const maintenanceDueLabel = (maintenance, formatDate) => {
  if (!maintenance) return "-";
  if (maintenance.dueAt) return `Date prevue: ${formatDate(maintenance.dueAt)}`;
  if (typeof maintenance.odometerKm === "number") return `Kilometrage cible: ${maintenance.odometerKm.toLocaleString()} km`;
  return "-";
};

export const getVidangeAlert = (maintenance, vehicleOdometerKm) => {
  if (!maintenance) return null;
  const type = String(maintenance.maintenanceType || "").toUpperCase();
  const dueKm = Number(maintenance.odometerKm || 0);
  const currentKm = Number(vehicleOdometerKm || 0);

  if (type !== "VIDANGE" || dueKm <= 0) return null;

  const kmRemaining = dueKm - currentKm;
  if (kmRemaining < 0) {
    return {
      level: "danger",
      text: `Alerte vidange: en retard de ${Math.abs(kmRemaining).toLocaleString()} km`,
    };
  }
  if (kmRemaining <= 500) {
    return {
      level: "warning",
      text: `Alerte vidange: a faire dans ${kmRemaining.toLocaleString()} km`,
    };
  }
  return null;
};
