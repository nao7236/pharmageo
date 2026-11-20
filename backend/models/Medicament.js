const mongoose = require('mongoose');

const medicamentSchema = new mongoose.Schema(
  {
    nom_commercial: { type: String, required: true, trim: true },
    dci: { type: String, default: '', trim: true },
    dosage: { type: String, default: '', trim: true },
    forme_galenique: { type: String, default: '', trim: true },
    prix_indicatif: { type: Number, default: 1000 },
  },
  { timestamps: true }
);

medicamentSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Medicament', medicamentSchema);