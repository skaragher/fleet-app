// backend/routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-jwt-super-securise';

// Middleware CORS pour les tests
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 Login request:', {
      body: { ...req.body, password: req.body.password ? '***' : undefined },
      headers: req.headers
    });

    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      console.log('❌ Validation failed: email or password missing');
      return res.status(400).json({ 
        success: false,
        message: 'Email et mot de passe requis' 
      });
    }

    // Rechercher l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() }
    });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Identifiants incorrects' 
      });
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Identifiants incorrects' 
      });
    }

    // Créer le token JWT (exclure le mot de passe)
    const { password: _, ...userWithoutPassword } = user;
    
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for:', user.email);

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('🔥 Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      error: error.message 
    });
  }
});

// Verify token
router.get('/verify', (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ valid: false, message: 'Missing token' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, user: payload });
  } catch (error) {
    return res.status(401).json({ valid: false, message: 'Invalid token' });
  }
});

export default router;
