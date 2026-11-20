const express = require('express');
const router = express.Router();
const Medicament = require('../models/Medicament');

router.get('/', async (req, res) => {
  try {
    const meds = await Medicament.find({}).sort({ nom_commercial: 1 });
    res.json(meds.map((m) => m.toJSON()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;