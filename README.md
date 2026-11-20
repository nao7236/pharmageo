# Guide d'Installation et Déploiement - PharmaGeo

## 1. Installation Backend
1. `cd backend`
2. `npm install`
3. Configurez `backend/.env` avec vos accès MySQL.
4. Importez `database/schema.sql` dans votre base MySQL.
5. `node server.js`

## 2. Installation Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## 3. Architecture
- **API :** RESTful (Node/Express).
- **Temps réel :** Socket.io pour les statuts de précommande.
- **Sécurité :** JWT (Auth), Chiffrement des mots de passe (bcrypt).
- **Géolocalisation :** Index SPATIAL MySQL + Haversine.

Votre plateforme est prête pour le développement final.
