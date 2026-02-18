// prisma/seed.js
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Démarrage du seed...");

  try {
    // ================= USERS ================= 
    const password = await bcrypt.hash("Abcd1234", 10);

    // Créer d'abord les véhicules
    const vehicles = await Promise.all([
      prisma.vehicle.upsert({
        where: { plate: "CI-100-AA" },
        update: {},
        create: {
          plate: "CI-100-AA",
          make: "Toyota",
          model: "Hilux",
          fuelType: "DIESEL",
          status: "EN_SERVICE",
          chassisNumber: "CHASSIS-100",
          odometerKm: 120000
        }
      }),
      prisma.vehicle.upsert({
        where: { plate: "CI-200-BB" },
        update: {},
        create: {
          plate: "CI-200-BB",
          make: "Nissan",
          model: "Navara",
          fuelType: "SUPER",
          status: "EN_REPARATION",
          chassisNumber: "CHASSIS-200",
          odometerKm: 180000
        }
      }),
      prisma.vehicle.upsert({
        where: { plate: "CI-300-CC" },
        update: {},
        create: {
          plate: "CI-300-CC",
          make: "Ford",
          model: "Ranger",
          fuelType: "DIESEL",
          status: "HORS_SERVICE",
          chassisNumber: "CHASSIS-300",
          odometerKm: 250000
        }
      })
    ]);
    console.log("✅ Véhicules créés");

    // ================= STATIONS =================
    let stationCentrale = await prisma.station.findFirst({
      where: { 
        AND: [
          { name: "Station Centrale" },
          { location: "Dépôt principal" }
        ]
      }
    });
    
    if (!stationCentrale) {
      stationCentrale = await prisma.station.create({
        data: {
          name: "Station Centrale",
          location: "Dépôt principal",
          address: "Route du Port, Abidjan",
          phone: "+22527201020"
        }
      });
      console.log("✅ Station Centrale créée");
    } else {
      console.log("✅ Station Centrale existe déjà");
    }

    let stationSecondaire = await prisma.station.findFirst({
      where: { 
        AND: [
          { name: "Station Secondaire" },
          { location: "Zone Nord" }
        ]
      }
    });
    
    if (!stationSecondaire) {
      stationSecondaire = await prisma.station.create({
        data: {
          name: "Station Secondaire",
          location: "Zone Nord",
          address: "Boulevard de Marseille, Yopougon",
          phone: "+22527203040"
        }
      });
      console.log("✅ Station Secondaire créée");
    } else {
      console.log("✅ Station Secondaire existe déjà");
    }

    const stations = [stationCentrale, stationSecondaire];

    // ================= USERS (suite) =================
    const users = await Promise.all([
      prisma.user.upsert({
        where: { email: "skaragher@gmail.com" },
        update: {},
        create: {
          name: "Super Admin",
          email: "skaragher@gmail.com",
          password,
          role: "SUPER_ADMIN",
          permissions: ["*"]
        }
      }),
      prisma.user.upsert({
        where: { email: "fleetmanager@fleet.local" },
        update: {},
        create: {
          name: "Gestionnaire Flotte",
          email: "fleetmanager@fleet.local",
          password,
          role: "FLEET_MANAGER",
          permissions: ["view_reports", "create_vehicle", "edit_station", "assign_driver"]
        }
      }),
      prisma.user.upsert({
        where: { email: "stationmanager@fleet.local" },
        update: {},
        create: {
          name: "Gestionnaire Station",
          email: "stationmanager@fleet.local",
          password,
          role: "STATION_MANAGER",
          assignedStationId: stationCentrale.id,
          permissions: ["view_station_reports", "manage_fuel", "approve_dispenses"]
        }
      }),
      prisma.user.upsert({
        where: { email: "viewer@fleet.local" },
        update: {},
        create: {
          name: "Observateur",
          email: "viewer@fleet.local",
          password,
          role: "VIEWER",
          permissions: ["view_reports"]
        }
      })
    ]);
    console.log("✅ Utilisateurs créés");

    // ================= DRIVERS ================= 
    const drivers = await Promise.all([
      prisma.driver.upsert({
        where: { licenseNo: "CI-DRV-001" },
        update: {},
        create: {
          fullName: "Kouassi Jean",
          phone: "+22501010101",
          licenseNo: "CI-DRV-001",
          typeLicence: "B",
          birthDate: new Date("1985-05-15")
        }
      }),
      prisma.driver.upsert({
        where: { licenseNo: "CI-DRV-002" },
        update: {},
        create: {
          fullName: "Yao Marcel",
          phone: "+22502020202",
          licenseNo: "CI-DRV-002",
          typeLicence: "C",
          birthDate: new Date("1990-08-22")
        }
      }),
      prisma.driver.upsert({
        where: { licenseNo: "CI-DRV-003" },
        update: {},
        create: {
          fullName: "Koné Ibrahim",
          phone: "+22503030303",
          licenseNo: "CI-DRV-003",
          typeLicence: "D",
          birthDate: new Date("1988-11-10")
        }
      })
    ]);
    console.log("✅ Chauffeurs créés");

    // ================= VEHICLE ASSIGNMENTS ================= 
    // Version corrigée sans utiliser vehicleId_driverId
    for (let i = 0; i < vehicles.length; i++) {
      // Vérifier si l'assignation existe déjà
      const existingAssignment = await prisma.vehicleAssignment.findFirst({
        where: {
          vehicleId: vehicles[i].id,
          driverId: drivers[i % drivers.length].id
        }
      });
      
      if (!existingAssignment) {
        await prisma.vehicleAssignment.create({
          data: {
            vehicleId: vehicles[i].id,
            driverId: drivers[i % drivers.length].id,
            userId: users[1].id // FLEET_MANAGER
          }
        });
      }
    }
    console.log("✅ Assignations véhicules créées");

    // ================= TANKS =================
    const tanks = [];
    for (const station of stations) {
      for (const fuelType of ["DIESEL", "SUPER", "LUBRIFIANT", "HUILE"]) {
        const existingTank = await prisma.tank.findFirst({
          where: {
            stationId: station.id,
            fuelType: fuelType
          }
        });
        
        if (!existingTank) {
          const tank = await prisma.tank.create({
            data: {
              stationId: station.id,
              fuelType,
              capacityL: 20000,
              currentL: 8000 + Math.floor(Math.random() * 5000),
              lowAlertL: 1500
            }
          });
          tanks.push(tank);
        } else {
          tanks.push(existingTank);
        }
      }
    }
    console.log(`✅ ${tanks.length} cuves créées/vérifiées`);

    // ================= FUEL SUPPLY =================
    for (const tank of tanks) {
      const existingSupply = await prisma.fuelSupply.findFirst({
        where: {
          tankId: tank.id
        }
      });
      
      if (!existingSupply) {
        await prisma.fuelSupply.create({
          data: {
            stationId: tank.stationId,
            tankId: tank.id,
            supplier: "TOTAL ENERGIES",
            deliveredL: 3000 + Math.floor(Math.random() * 2000),
            unitPrice: 700 + Math.random() * 200,
            deliveryRef: `BL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            deliveredAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 3600 * 1000),
            notes: `Livraison ${tank.fuelType}`
          }
        });
      }
    }
    console.log("✅ Approvisionnements créés");

    // ================= INSURERS =================
    let nsia = await prisma.insurer.findFirst({
      where: { name: "NSIA" }
    });
    
    if (!nsia) {
      nsia = await prisma.insurer.create({
        data: {
          name: "NSIA",
          location: "Abidjan Plateau",
          address: "Immeuble NSIA, Avenue Noguès",
          phone1: "+22520212021"
        }
      });
    }

    let sunu = await prisma.insurer.findFirst({
      where: { name: "SUNU" }
    });
    
    if (!sunu) {
      sunu = await prisma.insurer.create({
        data: {
          name: "SUNU",
          location: "Abidjan Cocody",
          address: "Rue des Jardins, Deux Plateaux",
          phone1: "+22527272727"
        }
      });
    }

    const insurers = [nsia, sunu];
    console.log("✅ Assureurs créés");

    // ================= INSURANCE POLICIES =================
    for (const vehicle of vehicles) {
      for (const insurancesType of ["RC", "TIERS", "INTERMEDIAIRE", "TOUS_RISQUES"]) {
        const insurer = insurers[Math.floor(Math.random() * insurers.length)];
        const existingPolicy = await prisma.insurancePolicy.findFirst({
          where: {
            vehicleId: vehicle.id,
            insurancesType: insurancesType
          }
        });
        
        if (!existingPolicy) {
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setFullYear(endDate.getFullYear() + 1);

          await prisma.insurancePolicy.create({
            data: {
              vehicleId: vehicle.id,
              insurerId: insurer.id,
              insurancesType,
              policyNo: `POL-${vehicle.plate}-${insurancesType}`,
              startAt: startDate,
              endAt: endDate,
              premium: 80000 + Math.random() * 100000,
              durationValue: 1,
              durationUnit: "YEAR"
            }
          });
        }
      }
    }
    console.log("✅ Polices d'assurance créées");

    // ================= MAINTENANCE =================
    const maintenanceStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
    for (const vehicle of vehicles) {
      for (const maintenanceType of ["REVISION", "VIDANGE", "REPARATION", "DEPANNAGE"]) {
        const existingMaintenance = await prisma.maintenance.findFirst({
          where: {
            vehicleId: vehicle.id,
            maintenanceType: maintenanceType
          }
        });
        
        if (!existingMaintenance) {
          await prisma.maintenance.create({
            data: {
              vehicleId: vehicle.id,
              maintenanceType,
              description: `${maintenanceType} pour ${vehicle.plate}`,
              cost: 20000 + Math.random() * 80000,
              odometerKm: vehicle.odometerKm + Math.floor(Math.random() * 5000),
              dueAt: new Date(Date.now() + (15 + Math.floor(Math.random() * 30)) * 24 * 3600 * 1000),
              status: maintenanceStatuses[Math.floor(Math.random() * maintenanceStatuses.length)]
            }
          });
        }
      }
    }
    console.log("✅ Maintenances créées");

    // ================= INSPECTIONS ================= 
    for (const vehicle of vehicles) {
      const existingInspection = await prisma.inspection.findFirst({
        where: {
          vehicleId: vehicle.id,
          type: "VISITE_TECHNIQUE"
        }
      });
      
      if (!existingInspection) {
        const scheduledAt = new Date(Date.now() + 10 * 24 * 3600 * 1000);
        const nextInspect = new Date(scheduledAt);
        nextInspect.setFullYear(nextInspect.getFullYear() + 1);

        await prisma.inspection.create({
          data: {
            vehicleId: vehicle.id,
            type: "VISITE_TECHNIQUE",
            scheduledAt,
            nextInspect,
            result: Math.random() > 0.5 ? "FAVORABLE" : "RESERVE",
            center: "Centre Technique National",
            cost: 25000 + Math.random() * 15000,
            notes: `Inspection annuelle pour ${vehicle.plate}`
          }
        });
      }
    }
    console.log("✅ Inspections créées");

    console.log("\n🎉 SEED TERMINÉ AVEC SUCCÈS !");
    console.log("====================================");
    console.log("📊 RÉCAPITULATIF :");
    console.log(`👤 ${users.length} utilisateurs`);
    console.log(`🚗 ${vehicles.length} véhicules`);
    console.log(`👨‍✈️ ${drivers.length} chauffeurs`);
    console.log(`⛽ ${stations.length} stations`);
    console.log(`🛢️ ${tanks.length} cuves`);
    console.log(`🏢 ${insurers.length} assureurs`);
    console.log("\n🔑 IDENTIFIANTS DE TEST :");
    console.log("1. SUPER_ADMIN: superadmin@fleet.local / Abcd1234");
    console.log("2. FLEET_MANAGER: fleetmanager@fleet.local / Abcd1234");
    console.log("3. STATION_MANAGER: stationmanager@fleet.local / Abcd1234");
    console.log("4. VIEWER: viewer@fleet.local / Abcd1234");
    console.log("====================================");

  } catch (error) {
    console.error("❌ Erreur détaillée:", error);
    throw error;
  }
}

main()
  .catch(e => {
    console.error("❌ Erreur fatale lors du seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });