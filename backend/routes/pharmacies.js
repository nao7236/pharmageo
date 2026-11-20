const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Pharmacie = require('../models/Pharmacie');
const Medicament = require('../models/Medicament');

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractMedId(rawMed) {
  if (!rawMed) return null;
  if (typeof rawMed === 'object') {
    const candidate = rawMed._id || rawMed.id || null;
    return candidate ? String(candidate) : null;
  }
  return String(rawMed);
}

router.get('/', async (req, res) => {
  try {
    const list = await Pharmacie.find({ statut_agrement: { $ne: 'SUSPENDUE' } }).sort({ nom: 1 });
    res.json(list.map((p) => p.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const searchTerm = String(req.query.medicament || req.query.q || '').trim();

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'Paramètres lat et lng invalides ou manquants.' });
    }

    let matchingMedIds = [];
    if (searchTerm) {
      const regex = new RegExp(searchTerm, 'i');
      const meds = await Medicament.find({
        $or: [{ nom_commercial: regex }, { dci: regex }],
      }).select('_id');
      matchingMedIds = meds.map((m) => m._id);
    }

    const filter = {
      statut_agrement: { $ne: 'SUSPENDUE' },
    };

    if (searchTerm) {
      const regex = new RegExp(searchTerm, 'i');
      filter.$or = [
        { nom: regex },
        { adresse: regex },
        ...(matchingMedIds.length > 0
          ? [
              {
                stocks: {
                  $elemMatch: {
                    medicament_id: { $in: matchingMedIds },
                    quantite_disponible: { $gt: 0 },
                  },
                },
              },
            ]
          : []),
      ];
    }

    const docs = await Pharmacie.find(filter).limit(30);
    const formatted = docs
      .map((doc) => {
        const obj = doc.toJSON();
        obj.distance = haversineKm(lat, lng, obj.latitude, obj.longitude);
        return obj;
      })
      .sort((a, b) => a.distance - b.distance);

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/stocks', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return res.status(400).json({ error: 'Identifiant de pharmacie invalide.' });
    }

    const pharmacie = await Pharmacie.findById(req.params.id).populate(
      'stocks.medicament_id',
      'nom_commercial dci dosage forme_galenique prix_indicatif'
    );
    if (!pharmacie) {
      return res.status(404).json({ error: 'Pharmacie introuvable' });
    }

    const rows = (pharmacie.stocks || [])
      .map((s) => {
        const med = s.medicament_id && typeof s.medicament_id === 'object' ? s.medicament_id : null;
        const resolvedMedId = extractMedId(med || s.medicament_id);
        if (!resolvedMedId || !mongoose.Types.ObjectId.isValid(resolvedMedId)) {
          return null;
        }

        return {
          id: s._id ? String(s._id) : resolvedMedId,
          medicament_id: resolvedMedId,
          nom_commercial: med?.nom_commercial || 'Médicament',
          dci: med?.dci || '',
          dosage: med?.dosage || '',
          forme_galenique: med?.forme_galenique || '',
          prix_indicatif: med?.prix_indicatif ?? 1000,
          quantite_disponible: s.quantite_disponible,
          seuil_alerte: s.seuil_alerte,
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(a.nom_commercial).localeCompare(String(b.nom_commercial)));

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/stocks', async (req, res) => {
  try {
    const { medicament_id, quantite_disponible, seuil_alerte = 5 } = req.body;
    const resolvedMedId = extractMedId(medicament_id);

    if (!resolvedMedId || !mongoose.Types.ObjectId.isValid(resolvedMedId) || quantite_disponible === undefined) {
      return res.status(400).json({ error: 'medicament_id valide et quantite_disponible requis.' });
    }

    const pharmacie = await Pharmacie.findById(req.params.id);
    if (!pharmacie) {
      return res.status(404).json({ error: 'Pharmacie introuvable' });
    }

    const qte = Math.max(0, Number(quantite_disponible) || 0);
    const seuil = Math.max(0, Number(seuil_alerte) || 0);
    const idx = pharmacie.stocks.findIndex(
      (item) => extractMedId(item.medicament_id) === resolvedMedId
    );

    if (idx >= 0) {
      pharmacie.stocks[idx].quantite_disponible = qte;
      pharmacie.stocks[idx].seuil_alerte = seuil;
      pharmacie.stocks[idx].date_maj = new Date();
    } else {
      pharmacie.stocks.push({
        medicament_id: resolvedMedId,
        quantite_disponible: qte,
        seuil_alerte: seuil,
        date_maj: new Date(),
      });
    }

    await pharmacie.save();
    res.json({ message: 'Stock mis à jour' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;