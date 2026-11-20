const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Pharmacie = require('../models/Pharmacie');

const JWT_SECRET = process.env.JWT_SECRET || 'pharma_secret_key_2026';

router.post('/register', async (req, res) => {
  try {
    const { nom, prenom, email, telephone, mot_de_passe, role, pharmacie } = req.body;

    if (!nom?.trim() || !email?.trim() || !mot_de_passe) {
      return res.status(400).json({ error: 'Nom, email et mot de passe sont obligatoires' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = String(role || 'PATIENT').toUpperCase() === 'PHARMACIEN' ? 'PHARMACIEN' : 'PATIENT';

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const hash = await bcrypt.hash(mot_de_passe, 10);
    const createdUser = await User.create({
      nom: nom.trim(),
      prenom: (prenom || '').trim(),
      email: cleanEmail,
      telephone: (telephone || '').trim(),
      mot_de_passe_hash: hash,
      role: cleanRole,
      statut: 'actif',
    });

    if (cleanRole === 'PHARMACIEN' && pharmacie?.nom?.trim()) {
      const lat = Number.isFinite(Number(pharmacie.latitude)) ? Number(pharmacie.latitude) : 6.3654;
      const lng = Number.isFinite(Number(pharmacie.longitude)) ? Number(pharmacie.longitude) : 2.4183;

      await Pharmacie.create({
        utilisateur_id: createdUser._id,
        nom: pharmacie.nom.trim(),
        adresse: (pharmacie.adresse || 'À renseigner').trim(),
        latitude: lat,
        longitude: lng,
        location: { type: 'Point', coordinates: [lng, lat] },
        telephone: (pharmacie.telephone || telephone || '').trim(),
        est_de_garde: pharmacie.est_de_garde ? 1 : 0,
        statut_agrement: 'EN_ATTENTE',
      });
    }

    const userJson = createdUser.toJSON();
    const token = jwt.sign({ id: userJson.id, role: userJson.role }, JWT_SECRET, { expiresIn: '1d' });

    return res.status(201).json({
      message: 'Utilisateur créé avec succès',
      userId: userJson.id,
      token,
      user: userJson,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    const userDoc = await User.findOne({ email: String(email || '').trim().toLowerCase() });

    if (!userDoc) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const valid = await bcrypt.compare(mot_de_passe, userDoc.mot_de_passe_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    const userJson = userDoc.toJSON();
    const token = jwt.sign({ id: userJson.id, role: userJson.role }, JWT_SECRET, { expiresIn: '1d' });

    return res.json({ token, user: userJson });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;