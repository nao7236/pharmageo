const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Precommande = require('../models/Precommande');
const Pharmacie = require('../models/Pharmacie');
const Medicament = require('../models/Medicament');

function resolveMedicamentId(art) {
  return (
    art?.medicament_id ||
    art?.id_medicament ||
    art?.medicamentId ||
    art?.medicament?._id ||
    art?.medicament?.id ||
    art?._id ||
    art?.id ||
    null
  );
}

function parseJsonIfString(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

router.get('/', async (req, res) => {
  try {
    const filter = req.query.patient_id ? { patient_id: String(req.query.patient_id) } : {};
    const list = await Precommande.find(filter).sort({ date_creation: -1 });
    res.json(list.map((o) => o.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    let { patient_id = 1, pharmacie_id, articles = [], paiement = null } = req.body;

    articles = parseJsonIfString(articles, []);
    paiement = parseJsonIfString(paiement, null);

    if (!pharmacie_id || !mongoose.Types.ObjectId.isValid(String(pharmacie_id))) {
      return res.status(400).json({ error: 'pharmacie_id valide est requis.' });
    }

    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'pharmacie_id et articles sont requis.' });
    }

    const pharmacie = await Pharmacie.findById(pharmacie_id);
    if (!pharmacie) {
      return res.status(404).json({ error: 'Pharmacie introuvable' });
    }

    let total = 0;
    const lignes = [];

    for (const art of articles) {
      const medId = resolveMedicamentId(art);
      if (!medId || !mongoose.Types.ObjectId.isValid(String(medId))) {
        return res.status(400).json({
          error: 'Chaque article doit contenir un identifiant de médicament valide (medicament_id).',
        });
      }

      const qty = Math.max(1, Number(art.quantite) || 1);
      const med = await Medicament.findById(medId);
      const prix = med?.prix_indicatif ? Number(med.prix_indicatif) : 1000;
      total += prix * qty;

      lignes.push({
        medicament_id: medId,
        nom_commercial: med?.nom_commercial || art.nom_commercial || 'Médicament',
        quantite: qty,
        prix_unitaire: prix,
      });

      const stockIdx = pharmacie.stocks.findIndex(
        (s) => String(s.medicament_id) === String(medId)
      );
      if (stockIdx >= 0) {
        pharmacie.stocks[stockIdx].quantite_disponible = Math.max(
          0,
          Number(pharmacie.stocks[stockIdx].quantite_disponible || 0) - qty
        );
        pharmacie.stocks[stockIdx].date_maj = new Date();
      }
    }

    await pharmacie.save();

    const codeRetrait = 'PG-' + Math.floor(100000 + Math.random() * 900000);
    const created = await Precommande.create({
      patient_id: String(patient_id),
      pharmacie_id: pharmacie._id,
      pharmacie_nom: pharmacie.nom,
      statut: 'EN_ATTENTE',
      montant_total: paiement?.amount ? Number(paiement.amount) : total,
      code_retrait: codeRetrait,
      paiement,
      articles: lignes,
    });

    const json = created.toJSON();
    res.status(201).json({
      message: 'Précommande enregistrée',
      precommande_id: json.id,
      code_retrait: json.code_retrait,
      precommande: json,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;