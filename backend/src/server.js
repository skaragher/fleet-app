import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

import authRoutes from "./routes/auth.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";
import driversRoutes from "./routes/drivers.routes.js";
import stationsRoutes from "./routes/stations.routes.js";
import fuelRoutes from "./routes/fuel.routes.js";
import maintenanceRoutes from "./routes/maintenance.routes.js";
import insuranceRoutes from "./routes/insurance.routes.js";
import inspectionsRoutes from "./routes/inspections.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import insurersRoutes from "./routes/insurers.routes.js";
import fuelDispensesRoutes from './routes/fuel.dispenses.routes.js';  
import fuelSuppliesRoutes from './routes/fuel.supplies.routes.js'; 
import usersRoutes from "./routes/users.routes.js";
import companySettingsRoutes from "./routes/company-settings.routes.js";
import fuelReportsRoutes from "./routes/fuel.reports.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import reconciliationsRoutes from "./routes/reconciliations.routes.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set("trust proxy", 1);

// Configuration CORS dynamique
const allowedOrigins = [
  'https://193.168.173.181',
  'http://193.168.173.181',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175'
];
const normalizedAllowedOrigins = allowedOrigins
  .map((o) => String(o).trim().toLowerCase().replace(/\/$/, ""));

const corsOptions = {
  origin: function (origin, callback) {
    // En développement, autoriser toutes les origines
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Autoriser les requêtes sans origine (comme Postman, curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Vérifier si l'origine est autorisée
    const normalizedOrigin = String(origin).trim().toLowerCase().replace(/\/$/, "");
    if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
      callback(null, origin);
    } else {
      console.warn(`⚠️ CORS bloqué pour l'origine: ${origin}`);
      callback(new Error(`L'origine ${origin} n'est pas autorisée par CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'X-User-ID',
    'X-User-Role', 
    'X-User-Name',
    'X-Assigned-Vehicle-ID', 
    'X-Assigned-Station-ID', 
    'X-User-Permissions'
  ],
  exposedHeaders: ['Content-Length', 'X-Total-Count'],
  maxAge: 86400 // 24 heures
};

// Appliquer CORS
app.use(cors(corsOptions));

// Gérer les pré-voleurs OPTIONS
app.options('*', cors(corsOptions));

// Middlewares de sécurité
app.use(helmet({
  contentSecurityPolicy: false,          // Géré par Nginx si nécessaire
  hsts: false,                           // Pas de HTTPS → pas de HSTS
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Middleware pour parser le JSON
app.use(express.json({ limit: "5mb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// Logger
app.use(morgan("dev"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limite chaque IP à 300 requêtes par fenêtre
  message: {
    status: 429,
    message: "Trop de requêtes, veuillez réessayer plus tard."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Route de test
app.get("/", (_req, res) => {
  res.json({ 
    ok: true, 
    name: "Fleet API", 
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development',
    cors: allowedOrigins
  });
});

// Route de santé
app.get("/health", (_req, res) => {
  res.status(200).json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes API
app.use("/api/auth", authRoutes);
// Compat: anciens clients sans préfixe `/api`
app.use("/auth", authRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/drivers", driversRoutes);
app.use("/api/stations", stationsRoutes);
// Monter les routes spécialisées avant /api/fuel pour éviter qu'elles soient masquées
app.use('/api/fuel/dispenses', fuelDispensesRoutes);
app.use('/api/fuel/supplies', fuelSuppliesRoutes);
app.use("/api/fuel", fuelRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/insurance", insuranceRoutes);
app.use("/api/inspections", inspectionsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/insurers", insurersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/company-settings", companySettingsRoutes);
app.use("/api/fuel/reports", fuelReportsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/reconciliations", reconciliationsRoutes);

// Middleware pour les routes non trouvées
app.use((req, res, next) => {
  res.status(404).json({
    error: "Route non trouvée",
    path: req.path,
    method: req.method
  });
});

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err.stack);
  
  // Erreur CORS
  if (String(err?.message || "").includes('CORS')) {
    return res.status(403).json({
      error: "Erreur CORS",
      message: err.message,
      allowedOrigins: allowedOrigins
    });
  }
  
  res.status(err.status || 500).json({
    error: "Erreur interne du serveur",
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🚀 Fleet API en cours d'exécution sur http://${HOST}:${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔓 CORS autorisé pour: ${allowedOrigins.join(', ')}`);
});
