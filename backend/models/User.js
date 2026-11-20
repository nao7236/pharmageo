const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    prenom: { type: String, default: '', trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    telephone: { type: String, default: '', trim: true },
    mot_de_passe_hash: { type: String, required: true },
    role: { type: String, enum: ['PATIENT', 'PHARMACIEN', 'ADMIN'], default: 'PATIENT' },
    statut: { type: String, default: 'actif' },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.mot_de_passe_hash;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);