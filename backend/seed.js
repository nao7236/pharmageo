require('dotenv').config();
const mongoose = require('./db');
const Medicament = require('./models/Medicament');
const Pharmacie = require('./models/Pharmacie');

async function seed() {
  const medCount = await Medicament.countDocuments();
  let meds = await Medicament.find({});

  if (medCount === 0) {
    meds = await Medicament.insertMany([
      { nom_commercial: 'Doliprane 1000mg', dci: 'Paracétamol', dosage: '1000mg', forme_galenique: 'Comprimé', prix_indicatif: 1200 },
      { nom_commercial: 'Amoxicilline 500mg', dci: 'Amoxicilline', dosage: '500mg', forme_galenique: 'Gélule', prix_indicatif: 2500 },
      { nom_commercial: 'Coartem 80/480', dci: 'Artéméther / Luméfantrine', dosage: '80/480mg', forme_galenique: 'Comprimé', prix_indicatif: 4500 },
    ]);
  }

  const pharmaCount = await Pharmacie.countDocuments();
  if (pharmaCount === 0) {
    await Pharmacie.insertMany([
      {
        nom: 'Pharmacie Agblangandan',
        adresse: 'Route de Porto-Novo, Agblangandan',
        latitude: 6.3821,
        longitude: 2.5248,
        location: { type: 'Point', coordinates: [2.5248, 6.3821] },
        telephone: '+229 01 97 00 11 22',
        est_de_garde: 1,
        statut_agrement: 'VALIDE',
        horaires_json: { garde: { jours: 'Lun – Dim', heures: '20h00 – 08h00 (24h/24 dimanches)' } },
        stocks: meds.map((m, i) => ({
          medicament_id: m._id,
          quantite_disponible: 25 + i * 10,
          seuil_alerte: 5,
        })),
      },
      {
        nom: 'Pharmacie Agla',
        adresse: 'Carrefour Agla, Cotonou',
        latitude: 6.3712,
        longitude: 2.3985,
        location: { type: 'Point', coordinates: [2.3985, 6.3712] },
        telephone: '+229 01 96 00 33 44',
        est_de_garde: 1,
        statut_agrement: 'VALIDE',
        horaires_json: { garde: { jours: 'Lun – Dim', heures: '20h00 – 08h00' } },
        stocks: meds.map((m, i) => ({
          medicament_id: m._id,
          quantite_disponible: 15 + i * 5,
          seuil_alerte: 5,
        })),
      },
    ]);
  }

  console.log('Seed MongoDB terminé');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});