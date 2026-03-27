import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

let poolConfig;

// Si DATABASE_URL est fournie, l'utiliser
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
  };
} else {
  // Sinon utiliser les paramètres individuels
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'flottech_db',
    user: process.env.DB_USER || 'karagher',
    password: process.env.DB_PASSWORD || '1933',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

const pool = new Pool(poolConfig);

// Tester la connexion
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connexion PostgreSQL établie avec flottech_db');
    console.log(`📊 Base de données: ${process.env.DB_NAME || 'flottech_db'}`);
    console.log(`👤 Utilisateur: ${process.env.DB_USER || 'karagher'}`);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion PostgreSQL:', error.message);
    return false;
  }
};

// Exporter le pool pour les requêtes
export default pool;
