import { Router } from "express";
import { prisma } from "../prisma.js";
import { auth } from "../middleware/auth.js";
import { parse, insurerSchema } from "../validators.js";
import { errorHandler } from "../middleware/errors.js";

const router = Router();

// GET / - Liste de tous les assureurs
router.get("/", auth(), async (_req, res, next) => {
  try {
    console.log("🔄 GET /api/insurers - Chargement...");
    
    // Utiliser Prisma pour récupérer les assureurs
    const insurers = await prisma.insurer.findMany({
      orderBy: { name: "asc" }
    });
    
    console.log(`✅ ${insurers.length} assureurs chargés`);
    res.json(insurers);
    
  } catch (e) { 
    console.error("❌ Erreur GET /insurers:", e);
    next(e); 
  }
});

// GET /:id - Un assureur par ID
router.get("/:id", auth(), async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`🔄 GET /api/insurers/${id}`);
    
    const insurer = await prisma.insurer.findUnique({ 
      where: { id }
    });
    
    if (!insurer) {
      console.log(`❌ Assureur ${id} non trouvé`);
      return res.status(404).json({ message: "Assureur introuvable" });
    }
    
    res.json(insurer);
    
  } catch (e) { 
    console.error(`❌ Erreur GET /insurers/${req.params.id}:`, e);
    next(e); 
  }
});

// POST / - Créer un nouvel assureur
router.post("/", auth(["SUPER_ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    console.log("🔄 POST /api/insurers - Données:", req.body);
    
    const data = parse(insurerSchema, req.body);
    
    // Vérifier si un assureur avec le même nom existe déjà
    const existingInsurer = await prisma.insurer.findFirst({
      where: { 
        name: { 
          equals: data.name, 
          mode: 'insensitive' 
        } 
      }
    });
    
    if (existingInsurer) {
      console.log(`❌ Assureur "${data.name}" existe déjà`);
      return res.status(409).json({ 
        message: "Un assureur avec ce nom existe déjà" 
      });
    }
    
    const insurer = await prisma.insurer.create({ 
      data: {
        ...data,
       // name: data.name || null,
        location: data.location || null,
        address: data.address || null,
        phone1: data.phone1 || null,
        phone2: data.phone2 || null
      }
    });
    
    console.log(`✅ Nouvel assureur créé: ${insurer.name}`);
    res.status(201).json(insurer);
    
  } catch (e) { 
    console.error("❌ Erreur POST /insurers:", e);
    next(e); 
  }
});

// PUT /:id - Mettre à jour un assureur
router.put("/:id", auth(["SUPER_ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`🔄 PUT /api/insurers/${id} - Données:`, req.body);
    
    const data = parse(insurerSchema.partial(), req.body);
    
    // Vérifier si l'assureur existe
    const existingInsurer = await prisma.insurer.findUnique({
      where: { id }
    });
    
    if (!existingInsurer) {
      console.log(`❌ Assureur ${id} non trouvé`);
      return res.status(404).json({ message: "Assureur introuvable" });
    }
    
    // Si le nom est modifié, vérifier qu'il n'existe pas déjà
    if (data.name && data.name !== existingInsurer.name) {
      const nameExists = await prisma.insurer.findFirst({
        where: { 
          name: { 
            equals: data.name, 
            mode: 'insensitive' 
          },
          NOT: { id }
        }
      });
      
      if (nameExists) {
        console.log(`❌ Nom "${data.name}" déjà utilisé`);
        return res.status(409).json({ 
          message: "Un autre assureur avec ce nom existe déjà" 
        });
      }
    }
    
    const insurer = await prisma.insurer.update({ 
      where: { id }, 
      data: {
        ...data,
        //name: data.name !== undefined ? data.name : existingInsurer.name,
        location: data.location !== undefined ? data.location : existingInsurer.location,
        address: data.address !== undefined ? data.address : existingInsurer.address,
        phone1: data.phone1 !== undefined ? data.phone1 : existingInsurer.phone1,
        phone2: data.phone2 !== undefined ? data.phone2 : existingInsurer.phone2,
      }
    });
    
    console.log(`✏️ Assureur mis à jour: ${insurer.name}`);
    res.json(insurer);
    
  } catch (e) { 
    console.error(`❌ Erreur PUT /insurers/${req.params.id}:`, e);
    
    if (e.code === 'P2025') {
      return res.status(404).json({ message: "Assureur introuvable" });
    }
    
    next(e); 
  }
});

// DELETE /:id - Supprimer un assureur
router.delete("/:id", auth(["SUPER_ADMIN", "FLEET_MANAGER"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`🔄 DELETE /api/insurers/${id}`);
    
    // Vérifier d'abord si l'assureur existe
    const insurer = await prisma.insurer.findUnique({
      where: { id },
      include: {
        policies: {
          take: 1 // Juste pour vérifier s'il y a des polices
        }
      }
    });
    
    if (!insurer) {
      console.log(`❌ Assureur ${id} non trouvé`);
      return res.status(404).json({ message: "Assureur introuvable" });
    }
    
    // Vérifier s'il y a des polices associées
    if (insurer.policies.length > 0) {
      console.log(`❌ L'assureur ${insurer.name} a ${insurer.policies.length} polices associées`);
      return res.status(400).json({ 
        message: "Impossible de supprimer cet assureur car il a des polices d'assurance associées" 
      });
    }
    
    await prisma.insurer.delete({ 
      where: { id } 
    });
    
    console.log(`🗑️ Assureur supprimé: ${insurer.name}`);
    res.status(204).end();
    
  } catch (e) { 
    console.error(`❌ Erreur DELETE /insurers/${req.params.id}:`, e);
    
    if (e.code === 'P2025') {
      return res.status(404).json({ message: "Assureur introuvable" });
    }
    
    next(e); 
  }
});

router.use(errorHandler);
export default router;