# Application Gestion de Flotte + Station Carburant + Entretien (Node.js API + Vue.js)

## Modules inclus
- Flotte: véhicules, chauffeurs (API CRUD)
- Station carburant interne: stations, cuves (tanks), approvisionnements (supplies), ravitaillements (dispenses)
- Entretien: maintenance (planification + historique)
- Assurances: polices par véhicule
- Visites techniques: planification / suivi
- Authentification: JWT (compte admin démo)

## Lancer le projet en local
### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

### Frontend
```bash
cd ../frontend
npm install
npm run dev
```

Connectez-vous sur: http://localhost:5173
Identifiants démo: admin@demo.local / admin123

## Notes
- Base de données: SQLite (dev). Pour PostgreSQL/MySQL, il suffit de modifier provider + DATABASE_URL dans Prisma.
