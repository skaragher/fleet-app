import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../prisma.js';
import { auth } from '../middleware/auth.js';
import { extractAssignedStationIds } from '../utils/userScope.js';

const router = express.Router();
const getJwtSecret = () => process.env.JWT_SECRET || 'votre-secret-jwt-super-securise';
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
  const extraRoles = Array.isArray(rest.roles) ? rest.roles : [];
  const allRoles = Array.from(new Set([rest.role, ...extraRoles].filter(Boolean)));
  return {
    ...rest,
    roles: extraRoles,
    allRoles,
    avatarUrl: avatarUrlOverride || rest.avatarUrl || null,
    assignedStationIds: extractAssignedStationIds(rest),
  };
};

const buildToken = (user) => {
  const assignedStationIds = extractAssignedStationIds(user);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      roles,
      isActive: user.isActive !== false,
      assignedVehicleId: user.assignedVehicleId || null,
      assignedStationId: user.assignedStationId || null,
      assignedStationIds,
    },
    getJwtSecret(),
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

const clampMinutes = (value, fallback = 30) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), 1), 1440);
};

const PASSWORD_RESET_SECRET = process.env.PASSWORD_RESET_TOKEN_SECRET || getJwtSecret();
const PASSWORD_RESET_EXPIRES_MINUTES = clampMinutes(process.env.PASSWORD_RESET_EXPIRES_MINUTES, 30);
const PASSWORD_RESET_DEBUG = String(process.env.PASSWORD_RESET_DEBUG || '').toLowerCase() === 'true';

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return fallback;
};

const hashResetToken = (token) => {
  const value = String(token || '');
  return crypto.createHmac('sha256', PASSWORD_RESET_SECRET).update(value).digest('hex');
};

const getAppBaseUrl = (req) => {
  const fromEnv =
    process.env.APP_BASE_URL ||
    process.env.FRONTEND_URL ||
    process.env.WEB_URL ||
    '';

  const clean = String(fromEnv).trim().replace(/\/$/, '');
  if (clean) return clean;

  // Fallback dev default
  return 'http://localhost:5173';
};

const trySendPasswordResetEmail = async ({ to, resetUrl }) => {
  const subject = 'Réinitialisation de votre mot de passe';
  const text = `Bonjour,\n\nPour réinitialiser votre mot de passe, cliquez sur ce lien:\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n`;

  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  let secure = parseBool(process.env.SMTP_SECURE, port === 465);
  const requireTLS = parseBool(process.env.SMTP_REQUIRE_TLS, port === 587);
  const tlsRejectUnauthorized = parseBool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true);

  const smtpConfigured = !!(host && user && pass && from);
  if (!smtpConfigured) {
    // Pas de SMTP: ne pas casser le flux. En debug, on log le lien.
    if (PASSWORD_RESET_DEBUG || process.env.NODE_ENV !== 'production') {
      console.log('[password-reset] resetUrl:', resetUrl);
    }
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    const { default: nodemailer } = await import('nodemailer');

    // Common pitfall: port 587 expects STARTTLS, not implicit TLS.
    if (port === 587 && secure === true) {
      console.warn('[password-reset] SMTP_SECURE=true with port 587; forcing SMTP_SECURE=false (STARTTLS).');
      secure = false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user, pass },
      tls: { rejectUnauthorized: tlsRejectUnauthorized },
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });

    return { sent: true };
  } catch (err) {
    console.warn('[password-reset] email send failed:', err?.message || err);
    if (PASSWORD_RESET_DEBUG || process.env.NODE_ENV !== 'production') {
      console.log('[password-reset] resetUrl:', resetUrl);
    }

    return {
      sent: false,
      reason: 'smtp_send_failed',
      errorCode: err?.code || err?.name || 'error',
      errorMessage: String(err?.message || err || ''),
    };
  }
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, email, licenseNo, password } = req.body || {};
    const rawIdentifier = String(identifier ?? email ?? licenseNo ?? '').trim();
    const normalizedEmail = rawIdentifier.toLowerCase();
    const normalizedLicenseNo = rawIdentifier.toUpperCase();

    if (!rawIdentifier || !password) {
      await recordLoginAttempt({
        email: rawIdentifier || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        success: false,
      });
      return res.status(400).json({
        success: false,
        message: 'Identifiant et mot de passe requis',
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedEmail, mode: 'insensitive' } },
          { licenseNo: { equals: normalizedLicenseNo, mode: 'insensitive' } },
        ],
      },
      include: USER_INCLUDE,
    });

    if (!user) {
      await recordLoginAttempt({
        email: rawIdentifier || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        success: false,
      });
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects',
      });
    }

    if (user.isActive === false) {
      await recordLoginAttempt({
        userId: user.id,
        email: user.email || rawIdentifier,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        success: false,
      });
      return res.status(403).json({
        success: false,
        message: "Compte désactivé. Contactez l'administrateur.",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      await recordLoginAttempt({
        userId: user.id,
        email: user.email || rawIdentifier,
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
      email: user.email || rawIdentifier,
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

// Mot de passe oublié
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier, email, licenseNo } = req.body || {};
    const raw = String(identifier ?? email ?? licenseNo ?? '').trim();

    if (!raw) {
      return res.status(400).json({ success: false, message: 'Email requis' });
    }

    const normalizedEmail = raw.toLowerCase();
    const normalizedLicenseNo = raw.toUpperCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { licenseNo: normalizedLicenseNo },
        ],
      },
      select: { id: true, email: true, isActive: true },
    });

    // Réponse neutre pour éviter de révéler si l'utilisateur existe.
    const genericResponse = {
      success: true,
      message: 'Si un compte existe, un lien de réinitialisation a été envoyé.',
    };

    if (!user || user.isActive === false || !user.email) {
      return res.json(genericResponse);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

    // Nettoyer les anciens tokens non utilisés (optionnel)
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
      },
    });

    const resetUrl = `${getAppBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
    const delivery = await trySendPasswordResetEmail({ to: user.email, resetUrl });

    if (PASSWORD_RESET_DEBUG) {
      return res.json({
        ...genericResponse,
        debugResetUrl: resetUrl,
        debugEmailSent: delivery?.sent === true,
        debugEmailReason: delivery?.sent ? null : (delivery?.reason || 'unknown'),
        debugEmailErrorCode: delivery?.sent ? null : (delivery?.errorCode || null),
        debugEmailErrorMessage: delivery?.sent ? null : (delivery?.errorMessage || null),
      });
    }

    return res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Réinitialiser le mot de passe
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword, password } = req.body || {};
    const rawToken = String(token || '').trim();
    const nextPassword = String(newPassword || password || '').trim();

    if (!rawToken || !nextPassword) {
      return res.status(400).json({ success: false, message: 'Token et nouveau mot de passe requis' });
    }

    if (!isStrongPassword(nextPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe faible (8+ caracteres, majuscule, minuscule, chiffre, special).',
      });
    }

    const now = new Date();
    const tokenHash = hashResetToken(rawToken);

    const record = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true, userId: true },
    });

    if (!record) {
      return res.status(400).json({ success: false, message: 'Token invalide ou expiré' });
    }

    const hashed = await bcrypt.hash(nextPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, usedAt: null },
      }),
    ]);

    return res.json({ success: true, message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
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

    const payload = jwt.verify(token, getJwtSecret());
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

// Utilisateurs connectés récemment (approximation "en ligne")
router.get('/connected-users', auth(['SUPER_ADMIN', 'FLEET_MANAGER']), async (req, res) => {
  try {
    if (!prisma?.loginHistory?.findMany) {
      return res.json({ success: true, windowMinutes: 30, onlineCount: 0, totalUsers: 0, items: [] });
    }

    const windowMinutes = clampMinutes(req.query.windowMinutes, 30);
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const isFleetManager = String(req.user?.role || '').toUpperCase() === 'FLEET_MANAGER';

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(isFleetManager ? { role: 'DRIVER' } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roles: true,
      },
      orderBy: { name: 'asc' },
    });

    if (!users.length) {
      return res.json({ success: true, windowMinutes, onlineCount: 0, totalUsers: 0, items: [] });
    }

    const userIds = users.map((u) => u.id);
    const history = await prisma.loginHistory.findMany({
      where: {
        success: true,
        userId: { in: userIds },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });

    const latestByUserId = new Map();
    for (const row of history) {
      if (!row?.userId) continue;
      if (!latestByUserId.has(row.userId)) latestByUserId.set(row.userId, row);
    }

    const items = users
      .map((u) => {
        const last = latestByUserId.get(u.id) || null;
        const lastLoginAt = last?.createdAt || null;
        const isOnline = !!(lastLoginAt && new Date(lastLoginAt) >= cutoff);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          roles: Array.isArray(u.roles) ? u.roles : [],
          isOnline,
          lastLoginAt,
          ipAddress: last?.ipAddress || null,
          userAgent: last?.userAgent || null,
        };
      })
      .sort((a, b) => {
        const aTs = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const bTs = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        return bTs - aTs;
      });

    const onlineCount = items.filter((x) => x.isOnline).length;
    return res.json({
      success: true,
      windowMinutes,
      onlineCount,
      totalUsers: items.length,
      items,
    });
  } catch (error) {
    console.error('Connected users error:', error);
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
