import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { auth } from "../middleware/auth.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const SETTINGS_FILE = path.join(DATA_DIR, "company-settings.json");
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads/company-logos");
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif", "svg"]);

const defaultSettings = {
  name: "FLEETENERGY",
  tagline: "Gestion de flotte et energie",
  logoUrl: "",
  email: "",
  phone: "",
  address: "",
  footerNote: "Tous droits reserves.",
};

const readSettings = async () => {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return { ...defaultSettings, ...(parsed || {}) };
  } catch {
    return { ...defaultSettings };
  }
};

const writeSettings = async (data) => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf8");
};

const parseBase64Image = (dataUrl) => {
  const match = String(dataUrl || "").match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  const rawExt = match[1].toLowerCase();
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  if (!ALLOWED_LOGO_EXTENSIONS.has(ext)) return null;
  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > MAX_LOGO_BYTES) return null;
  return { ext, data };
};

router.get("/", auth(), async (_req, res) => {
  const settings = await readSettings();
  res.json({ success: true, settings });
});

router.put("/", auth(["SUPER_ADMIN"]), async (req, res) => {
  const next = { ...defaultSettings, ...(req.body || {}) };
  await writeSettings(next);
  res.json({ success: true, settings: next, message: "Parametres mis a jour" });
});

router.post("/logo", auth(["SUPER_ADMIN"]), async (req, res) => {
  const parsed = parseBase64Image(req.body?.logoBase64);
  if (!parsed) {
    return res.status(400).json({
      success: false,
      message: "Image invalide. Formats: png, jpg, jpeg, webp, gif, bmp, avif, svg. Taille max: 2MB.",
    });
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `company-logo-${Date.now()}.${parsed.ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  await fs.writeFile(filePath, parsed.data);

  const settings = await readSettings();
  const logoUrl = `/uploads/company-logos/${filename}`;
  const next = { ...settings, logoUrl };
  await writeSettings(next);

  return res.json({
    success: true,
    logoUrl,
    settings: next,
    message: "Logo telecharge avec succes",
  });
});

export default router;
