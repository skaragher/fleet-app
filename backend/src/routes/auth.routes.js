import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../prisma.js';
import { auth } from '../middleware/auth.js';
import { extractAssignedStationIds } from '../utils/userScope.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-jwt-super-securise';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATARS_DIR = path.resolve(__dirname, '../../uploads/avatars');
const AVATAR_INDEX_FILE = path.join(AVATARS_DIR, 'index.json');
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif']);

const USER_INCLUDE = {
  assignedVehicle: { select: { id: true, plate: true } },
  assignedStation: { select: { id: true, name: true } },
};

const sanitizeUser = (user, avatarUrlOverride = null) => {
  if (!user) return null;
  const { password, ...rest } = user;
  return {
    ...rest,
    avatarUrl: avatarUrlOverride || rest.avatarUrl || null,
    assignedStationIds: extractAssignedStationIds(rest),
  };
};

const buildToken = (user) => {
  const assignedStationIds = extractAssignedStationIds(user);
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      assignedVehicleId: user.assignedVehicleId || null,
      assignedStationId: user.assignedStationId || null,
      assignedStationIds,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || null;
};

const isStrongPassword = (value) => {
  const password = String(value || '');
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

const parseBase64Image = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) return null;
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > MAX_AVATAR_BYTES) return null;
  return { ext, data };
};

const readAvatarIndex = async () => {
  try {
    const raw = await fs.readFile(AVATAR_INDEX_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
};

const writeAvatarIndex = async (index) => {
  await fs.mkdir(AVATARS_DIR, { recursive: true });
  await fs.writeFile(AVATAR_INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
};

const normalizeAvatarUrl = (url) => {
  const value = String(url || '');
  if (!value) return null;
  if (value.startsWith('/api/auth/avatar/')) return value;
  const filename = value.split('/').pop();
  if (!filename) return null;
  return `/api/auth/avatar/${filename}`;
};

const getAvatarUrlForUser = async (user) => {
  const id = user?.id;
  if (!id) return null;
  if (user.avatarUrl) return normalizeAvatarUrl(user.avatarUrl);
  const index = await readAvatarIndex();
  return normalizeAvatarUrl(index[id]) || null;
};

const saveAvatarUrlForUser = async (userId, avatarUrl) => {
  const index = await readAvatarIndex();
  index[userId] = normalizeAvatarUrl(avatarUrl);
  await writeAvatarIndex(index);
};

const recordLoginAttempt = async ({ userId = null, email = null, ipAddress = null, userAgent = null, success = false }) => {
  try {
    if (!prisma?.loginHistory?.create) return;
    await prisma.loginHistory.create({
      data: { userId, email, ipAddress, userAgent, success },
    });
  } catch {
    // no-op: login tracking should never break auth flow
  }
};

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
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!email || !password) {
      await recordLoginAttempt({
        email: normalizedEmail || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        success: false,
      });
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: USER_INCLUDE,
    });

    if (!user) {
      await recordLoginAttempt({
        email: normalizedEmail || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        success: false,
      });
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      await recordLoginAttempt({
        userId: user.id,
        email: normalizedEmail,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        success: false,
      });
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects',
      });
    }

    const token = buildToken(user);
    await recordLoginAttempt({
      userId: user.id,
      email: normalizedEmail,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      success: true,
    });
    const avatarUrl = await getAvatarUrlForUser(user);

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: sanitizeUser(user, avatarUrl),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
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

// Mon profil
router.get('/me', auth(), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: USER_INCLUDE,
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const avatarUrl = await getAvatarUrlForUser(user);
    return res.json({ success: true, user: sanitizeUser(user, avatarUrl) });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mise à jour de mon profil
router.put('/me', auth(), async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const {
      name,
      email,
      currentPassword,
      newPassword,
      password,
    } = req.body || {};

    const updateData = {};

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return res.status(400).json({ success: false, message: 'Le nom est requis' });
      }
      updateData.name = cleanName;
    }

    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail) {
        return res.status(400).json({ success: false, message: 'Email invalide' });
      }
      updateData.email = cleanEmail;
    }

    const nextPassword = String(newPassword || password || '').trim();
    if (nextPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Mot de passe actuel requis' });
      }

      const isCurrentPasswordValid = await bcrypt.compare(String(currentPassword), currentUser.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect' });
      }

      if (!isStrongPassword(nextPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Mot de passe faible (8+ caracteres, majuscule, minuscule, chiffre, special).',
        });
      }

      updateData.password = await bcrypt.hash(nextPassword, 10);
    }

    if (!Object.keys(updateData).length) {
      const unchangedUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: USER_INCLUDE,
      });
      const avatarUrl = await getAvatarUrlForUser(unchangedUser);

      return res.json({
        success: true,
        message: 'Aucune modification',
        user: sanitizeUser(unchangedUser, avatarUrl),
      });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      include: USER_INCLUDE,
    });

    const token = buildToken(updated);
    const avatarUrl = await getAvatarUrlForUser(updated);

    return res.json({
      success: true,
      message: 'Profil mis à jour',
      token,
      user: sanitizeUser(updated, avatarUrl),
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });
    }

    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Upload avatar (base64 data URL)
router.post('/me/avatar', auth(), async (req, res) => {
  try {
    const parsed = parseBase64Image(req.body?.avatarBase64);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'Image invalide. Formats acceptes: png, jpg, jpeg, webp, gif, bmp, avif. Taille max: 2MB.',
      });
    }

    await fs.mkdir(AVATARS_DIR, { recursive: true });
    const filename = `${req.user.userId}-${Date.now()}.${parsed.ext}`;
    const absolutePath = path.join(AVATARS_DIR, filename);
    await fs.writeFile(absolutePath, parsed.data);

    const avatarUrl = `/api/auth/avatar/${filename}`;
    await saveAvatarUrlForUser(req.user.userId, avatarUrl);

    let updated = null;
    try {
      updated = await prisma.user.update({
        where: { id: req.user.userId },
        data: { avatarUrl },
        include: USER_INCLUDE,
      });
    } catch {
      // fallback when avatarUrl field is not yet migrated in DB
      updated = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: USER_INCLUDE,
      });
    }

    const token = buildToken(updated);
    return res.json({
      success: true,
      message: 'Avatar mis a jour',
      avatarUrl,
      token,
      user: sanitizeUser(updated, avatarUrl),
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Historique des connexions
router.get('/me/login-history', auth(), async (req, res) => {
  try {
    if (!prisma?.loginHistory?.findMany) {
      return res.json({ success: true, items: [] });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const history = await prisma.loginHistory.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        success: true,
        createdAt: true,
      },
    });

    return res.json({ success: true, items: history });
  } catch (error) {
    console.error('Login history error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Serve avatar image by filename
router.get('/avatar/:filename', async (req, res) => {
  try {
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename) return res.status(400).json({ success: false, message: 'Nom de fichier invalide' });

    const filePath = path.join(AVATARS_DIR, filename);
    await fs.access(filePath);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.sendFile(filePath);
  } catch {
    return res.status(404).json({ success: false, message: 'Avatar introuvable' });
  }
});

export default router;
