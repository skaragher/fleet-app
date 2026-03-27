import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { extractAssignedStationIds } from "../utils/userScope.js";

export function auth(requiredRoles = []) {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing token" });

    try {
      const jwtSecret = process.env.JWT_SECRET || "votre-secret-jwt-super-securise";
      const payload = jwt.verify(token, jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          role: true,
          roles: true,
          isActive: true,
          assignedVehicleId: true,
          assignedStationId: true,
          permissions: true,
        },
      });
      if (!user || user.isActive === false) {
        return res.status(401).json({ message: "Compte inactif ou introuvable" });
      }

      const additionalRoles = Array.isArray(user.roles) ? user.roles : [];
      const allRoles = Array.from(new Set([user.role, ...additionalRoles].filter(Boolean)));

      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        roles: additionalRoles,
        allRoles,
        isActive: true,
        assignedVehicleId: user.assignedVehicleId || null,
        assignedStationId: user.assignedStationId || null,
        assignedStationIds: extractAssignedStationIds(user),
      };

      if (requiredRoles.length && !requiredRoles.some((r) => allRoles.includes(r))) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    } catch (e) {
      return res.status(401).json({ message: "Invalid token" });
    }
  };
}
