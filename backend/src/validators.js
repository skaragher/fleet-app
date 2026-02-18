import { z } from "zod";

// ================= VEHICLE =================
export const vehicleSchema = z.object({
  plate: z.string().min(3),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  // Synchronisé avec Enum FuelType de Prisma
  fuelType: z.enum(["DIESEL", "SUPER", "LUBRIFIANT", "HUILE"]),
  commissioningDate: z.string().datetime().optional().nullable(),
  chassisNumber: z.string().min(5),
  odometerKm: z.number().int().nonnegative().optional().default(0),
  // Synchronisé avec Enum VehicleStatus de Prisma
  status: z.enum(["EN_SERVICE", "EN_REPARATION", "HORS_SERVICE"]).optional().default("EN_SERVICE")
});

// ================= DRIVER =================
export const driverSchema = z.object({
  fullName: z.string().min(3),
  birthDate: z.string().datetime().optional().nullable(),
  phone: z.string().optional().nullable(),
  licenseNo: z.string().min(2),
  typeLicence: z.string().min(1),
  endDateLicence: z.string().datetime().optional().nullable()
});

// ================= STATION =================
export const stationSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  openingDate: z.string().datetime().optional().nullable()
});

// ================= TANK (CUVES) =================
export const tankSchema = z.object({
  // Ajout du champ name devenu obligatoire dans votre Prisma
  name: z.string().min(2).default("Cuve Générique"),
  fuelType: z.enum(["DIESEL", "SUPER", "LUBRIFIANT", "HUILE"]),
  capacityL: z.number().int().positive(),
  currentL: z.number().int().nonnegative().optional().default(0),
  lowAlertL: z.number().int().nonnegative().optional().default(100)
});

// ================= FUEL SUPPLY (APPROVISIONNEMENT) =================
export const supplySchema = z.object({
  stationId: z.string().min(5),
  tankId: z.string().min(5),
  supplier: z.string().optional().nullable(),
  deliveredL: z.number().int().positive(),
  unitPrice: z.number().optional().nullable(),
  deliveryRef: z.string().optional().nullable(),
  deliveredAt: z.string().datetime().optional(),
  notes: z.string().optional().nullable()
});

// ================= FUEL DISPENSE (RAVITAILLEMENT) =================
export const dispenseSchema = z.object({
  stationId: z.string().min(5),
  tankId: z.string().min(5),
  vehicleId: z.string().min(5),
  driverId: z.string().optional().nullable(),
  liters: z.number().int().positive(),
  unitPrice: z.number().optional().nullable(),
  odometerKm: z.number().int().nonnegative(),
  dispensedAt: z.string().datetime().optional(),
  notes: z.string().optional().nullable()
});

// ================= MAINTENANCE =================
export const maintenanceSchema = z.object({
  vehicleId: z.string().min(5),
  maintenanceType: z.enum(["REVISION", "VIDANGE", "REPARATION", "DEPANNAGE"]),
  description: z.string().optional().nullable(),
  cost: z.number().optional().nullable(),
  odometerKm: z.number().int().nonnegative(),
  // On enlève .datetime() pour éviter les rejets lors du parse
  dueAt: z.string().optional().nullable(),
  doneAt: z.string().optional().nullable(),
  status: z.string().min(1).default("PLANNED")
});


// ================= INSURANCE =================

export const insuranceSchema = z.object({
  vehicleId: z.string().min(1, "Véhicule requis"),
  insurerId: z.string().min(1, "Assureur requis"),
  // Utilisation de l'Enum exact de Prisma
  insurancesType: z.enum(["RC", "TIERS", "INTERMEDIAIRE", "TOUS_RISQUES"]),
  policyNo: z.string().optional().nullable(),
  // Prisma attend un Float (number en JS)
  premium: z.number().nonnegative(),
  durationValue: z.number().int().positive().nullable().optional(),
  durationUnit: z.string().nullable().optional(),
  // Coerce transforme la String ISO du front en objet Date pour Prisma
  startAt: z.coerce.date().nullable().optional(),
  endAt: z.coerce.date().nullable().optional(),
});

// ================= INSPECTION (VISITE TECHNIQUE) =================
export const inspectionSchema = z.object({
  vehicleId: z.string().min(5),
  type: z.string().optional().default("VISITE_TECHNIQUE"),
  scheduledAt: z.string().datetime(),
  doneAt: z.string().datetime().optional().nullable(),
  nextInspect: z.coerce.date().nullable().optional(),
  result: z.string().optional().nullable(),
  center: z.string().optional().nullable(),
  cost: z.number().optional().nullable(),
  notes: z.string().optional().nullable()
});



// Schéma pour les assureurs
export const insurerSchema = z.object({
  name: z.string().min(2, "Le nom est requis").max(100),
  location: z.string().max(500).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  phone1: z.string().max(500).optional().nullable(), // Correction syntaxe ici
  phone2: z.string().max(500).optional().nullable(),
});

// Schéma pour les polices d'assurance (déjà existant probablement)


// ================= PARSER HELPER =================
export function parse(schema, body) {
  const r = schema.safeParse(body);
  if (!r.success) {
    const issues = r.error.issues.map(i => ({ 
      path: i.path.join("."), 
      message: i.message 
    }));
    const err = new Error("ValidationError");
    err.status = 400;
    err.issues = issues;
    throw err;
  }
  return r.data;
}