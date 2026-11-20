const mongoose = require('mongoose');

const ligneSchema = new mongoose.Schema({
  medicament_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicament', required: true },
  nom_commercial: { type: String, default: '' },
  quantite: { type: Number, required: true, min: 1 },
  prix_unitaire: { type: Number, default: 1000 },
});

const precommandeSchema = new mongoose.Schema(
  {
    patient_id: { type: mongoose.Schema.Types.Mixed, required: true },
    pharmacie_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacie', required: true },
    pharmacie_nom: { type: String, default: '' },
    statut: {
      type: String,
      enum: ['EN_ATTENTE', 'PRETE', 'RETIREE', 'ANNULEE'],
      default: 'EN_ATTENTE',
    },
    montant_total: { type: Number, default: 0 },
    code_retrait: { type: String, required: true },
    paiement: { type: mongoose.Schema.Types.Mixed, default: null },
    articles: [ligneSchema],
  },
  { timestamps: { createdAt: 'date_creation', updatedAt: 'date_maj' } }
);

precommandeSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Precommande', precommandeSchema);