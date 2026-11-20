const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Pharmacie = require('../models/Pharmacie');
const Medicament = require('../models/Medicament');
const Precommande = require('../models/Precommande');

function extractId(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') {
    const candidate = raw._id || raw.id || null;
    return candidate ? String(candidate) : null;
  }
  return String(raw);
}

async function adjustPharmacyStockForArticles(pharmacieId, articles, direction) {
  if (!pharmacieId || !Array.isArray(articles) || articles.length === 0) return;
  const pharmacie = await Pharmacie.findById(pharmacieId);
  if (!pharmacie) return;

  for (const art of articles) {
    const medId = extractId(art.medicament_id);
    const qty = Math.max(0, Number(art.quantite) || 0);
    if (!medId || qty === 0) continue;

    const idx = pharmacie.stocks.findIndex(
      (s) => extractId(s.medicament_id) === medId
    );

    if (idx >= 0) {
      const current = Number(pharmacie.stocks[idx].quantite_disponible) || 0;
      pharmacie.stocks[idx].quantite_disponible = Math.max(0, current + direction * qty);
      pharmacie.stocks[idx].date_maj = new Date();
    } else if (direction > 0) {
      pharmacie.stocks.push({
        medicament_id: medId,
        quantite_disponible: qty,
        seuil_alerte: 5,
        date_maj: new Date(),
      });
    }
  }

  await pharmacie.save();
}

router.get('/dashboard', async (req, res) => {
  try {
    const utilisateurId = String(req.query.utilisateur_id || '').trim();
    if (!utilisateurId) {
      return res.status(400).json({ error: 'utilisateur_id requis.' });
    }

    const pharmaciesDocs = await Pharmacie.find({ utilisateur_id: utilisateurId })
      .populate('stocks.medicament_id', 'nom_commercial dci dosage forme_galenique prix_indicatif')
      .sort({ createdAt: 1 });

    const pharmacies = pharmaciesDocs.map((p) => p.toJSON());
    const pharmacie =
      pharmacies.find((p) => String(p.id) === String(req.query.pharmacie_id)) ||
      pharmacies[0] ||
      null;

    if (!pharmacie) {
      return res.json({
        pharmacies: [],
        pharmacie: null,
        stocks: [],
        catalogue: [],
        precommandes: [],
      });
    }

    const stocks = (pharmacie.stocks || [])
      .map((s) => {
        const med = s.medicament_id && typeof s.medicament_id === 'object' ? s.medicament_id : null;
        const resolvedMedId = extractId(med || s.medicament_id);
        return {
          id: String(s._id || s.id),
          medicament_id: resolvedMedId,
          nom_commercial: med?.nom_commercial || 'Médicament',
          dci: med?.dci || '',
          dosage: med?.dosage || '',
          forme_galenique: med?.forme_galenique || '',
          prix_indicatif: med?.prix_indicatif ?? 1000,
          quantite_disponible: s.quantite_disponible,
          seuil_alerte: s.seuil_alerte ?? 5,
        };
      })
      .sort((a, b) => String(a.nom_commercial).localeCompare(String(b.nom_commercial)));

    const catalogueDocs = await Medicament.find({}).sort({ nom_commercial: 1 });
    const catalogue = catalogueDocs.map((m) => m.toJSON());

    const ordersDocs = await Precommande.find({ pharmacie_id: pharmacie.id }).sort({ date_creation: -1 });
    const precommandes = ordersDocs.map((o) => o.toJSON());

    res.json({
      pharmacies,
      pharmacie,
      stocks,
      catalogue,
      precommandes,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/stocks/:stockId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.stockId))) {
      return res.status(400).json({ error: 'Identifiant de stock invalide.' });
    }

    const quantite = Math.max(0, Number(req.body.quantite_disponible ?? 0));
    const seuil = Math.max(0, Number(req.body.seuil_alerte ?? 5));

    const pharmacie = await Pharmacie.findOne({ 'stocks._id': req.params.stockId });
    if (!pharmacie) {
      return res.status(404).json({ error: 'Ligne de stock introuvable' });
    }

    const sub = pharmacie.stocks.id(req.params.stockId);
    sub.quantite_disponible = quantite;
    sub.seuil_alerte = seuil;
    sub.date_maj = new Date();
    await pharmacie.save();

    res.json({ message: 'Stock mis à jour avec succès' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/stocks', async (req, res) => {
  try {
    const pharmacieId = extractId(req.body.pharmacie_id);
    const medicamentId = extractId(req.body.medicament_id);
    const { quantite_disponible = 10, seuil_alerte = 5 } = req.body;

    if (
      !pharmacieId ||
      !medicamentId ||
      !mongoose.Types.ObjectId.isValid(pharmacieId) ||
      !mongoose.Types.ObjectId.isValid(medicamentId)
    ) {
      return res.status(400).json({ error: 'pharmacie_id et medicament_id valides requis.' });
    }

    const pharmacie = await Pharmacie.findById(pharmacieId);
    if (!pharmacie) {
      return res.status(404).json({ error: 'Pharmacie introuvable' });
    }

    const qteAjout = Math.max(0, Number(quantite_disponible) || 0);
    const seuil = Math.max(0, Number(seuil_alerte) || 0);
    const existingIdx = pharmacie.stocks.findIndex(
      (item) => extractId(item.medicament_id) === medicamentId
    );

    if (existingIdx >= 0) {
      pharmacie.stocks[existingIdx].quantite_disponible += qteAjout;
      pharmacie.stocks[existingIdx].seuil_alerte = seuil;
      pharmacie.stocks[existingIdx].date_maj = new Date();
    } else {
      pharmacie.stocks.push({
        medicament_id: medicamentId,
        quantite_disponible: qteAjout,
        seuil_alerte: seuil,
        date_maj: new Date(),
      });
    }

    await pharmacie.save();
    res.status(201).json({ message: 'Stock mis à jour' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/precommandes/:id/statut', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return res.status(400).json({ error: 'Identifiant de précommande invalide.' });
    }

    const { statut } = req.body;
    const allowed = ['EN_ATTENTE', 'PRETE', 'RETIREE', 'ANNULEE'];
    if (!allowed.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    const order = await Precommande.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Précommande introuvable' });
    }

    const previousStatus = order.statut;
    if (previousStatus !== statut) {
      if (statut === 'ANNULEE' && previousStatus !== 'ANNULEE') {
        await adjustPharmacyStockForArticles(order.pharmacie_id, order.articles, +1);
      } else if (previousStatus === 'ANNULEE' && statut !== 'ANNULEE') {
        await adjustPharmacyStockForArticles(order.pharmacie_id, order.articles, -1);
      }
      order.statut = statut;
      await order.save();
    }

    res.json({ message: 'Statut mis à jour', statut: order.statut });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/pharmacies/:id/garde', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      return res.status(400).json({ error: 'Identifiant de pharmacie invalide.' });
    }

    const estDeGarde = req.body.est_de_garde ? 1 : 0;
    const updated = await Pharmacie.findByIdAndUpdate(
      req.params.id,
      { est_de_garde: estDeGarde },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Pharmacie introuvable' });
    }

    res.json({ message: 'Statut de garde mis à jour', est_de_garde: updated.est_de_garde });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;