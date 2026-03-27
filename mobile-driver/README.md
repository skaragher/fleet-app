# FLEETENERGY Driver Mobile

Application mobile **installable** dédiée au profil `DRIVER`.
Les autres profils continuent d'utiliser l'application web.

## Fonctions incluses

- Connexion chauffeur (`/auth/login`)
- Header entreprise (nom/logo depuis `/api/company-settings`)
- Dashboard chauffeur mobile
- Mon véhicule mobile
- Rapports chauffeur mobile
- Profil + déconnexion

## Prérequis

- Node.js 18+
- Android Studio (Android) ou Xcode (iOS)
- Backend démarré sur `http://localhost:3000` (ou adapter l'URL)

## Installation

```bash
cd mobile-driver
npm install
```

## Configuration API

Par défaut: `http://localhost:3000/api` dans `app.json`:

```json
"extra": {
  "apiUrl": "http://localhost:3000/api"
}
```

Pour test sur téléphone physique Android, utilisez l'IP LAN du PC:

```json
"apiUrl": "http://192.168.x.x:3000/api"
```

## Lancer en dev

```bash
npm run start
```

## Build installable

### APK Android locale (si environnement natif prêt)

```bash
npm run android
```

### Build cloud (EAS)

1. Installer EAS:
```bash
npm i -g eas-cli
```
2. Login:
```bash
eas login
```
3. Configurer:
```bash
eas build:configure
```
4. Build Android:
```bash
eas build -p android
```
5. Build iOS:
```bash
eas build -p ios
```

## Sécurité côté rôle

Le mobile accepte uniquement les comptes `DRIVER` (contrôle après login).
Le backend garde le contrôle final des permissions.
