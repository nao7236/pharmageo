const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema({
  medicament_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicament', required: true },
  quantite_disponible: { type: Number, default: 0, min: 0 },
  seuil_alerte: { type: Number, default: 5, min: 0 },
  date_maj: { type: Date, default: Date.now },
});

const pharmacieSchema = new mongoose.Schema(
  {
    utilisateur_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    nom: { type: String, required: true, trim: true },
    adresse: { type: String, default: 'À renseigner', trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    telephone: { type: String, default: '' },
    est_de_garde: { type: Number, default: 0 },
    horaires_json: { type: mongoose.Schema.Types.Mixed, default: null },
    statut_agrement: {
      type: String,
      enum: ['EN_ATTENTE', 'VALIDE', 'SUSPENDUE'],
      default: 'EN_ATTENTE',
    },
    stocks: [stockItemSchema],
  },
  { timestamps: true }
);

pharmacieSchema.index({ location: '2dsphere' });

pharmacieSchema.pre('validate', function () {
  if (typeof this.longitude === 'number' && typeof this.latitude === 'number') {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude],
    };
  }
});

pharmacieSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Pharmacie', pharmacieSchema);