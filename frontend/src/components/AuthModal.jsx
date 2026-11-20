import { useState } from 'react';

export default function AuthModal({ apiUrl, infoMessage = '', onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('PATIENT'); // 'PATIENT' | 'PHARMACIEN'

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Champs spécifiques Pharmacien
  const [nomPharmacie, setNomPharmacie] = useState('');
  const [adresse, setAdresse] = useState('');
  const [telPharmacie, setTelPharmacie] = useState('');
  const [agrement, setAgrement] = useState('');
  const [latitude, setLatitude] = useState('6.3654');
  const [longitude, setLongitude] = useState('2.4183');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20';

  const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1.5';

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLatitude(pos.coords.latitude.toFixed(6));
      setLongitude(pos.coords.longitude.toFixed(6));
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email, mot_de_passe: motDePasse }
          : {
              nom,
              prenom,
              email,
              telephone,
              mot_de_passe: motDePasse,
              role,
              pharmacie:
                role === 'PHARMACIEN'
                  ? {
                      nom: nomPharmacie,
                      adresse,
                      telephone: telPharmacie || telephone,
                      agrement,
                      latitude,
                      longitude,
                    }
                  : undefined,
            };

      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || 'Échec de l’authentification');
        setLoading(false);
        return;
      }

      if (data.token) {
        localStorage.setItem('pharmageo_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('pharmageo_user', JSON.stringify(data.user));
        onAuthSuccess(data.user);
      }
      onClose();
    } catch {
      setError('Impossible de joindre le serveur backend local');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête dégradé */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition"
          >
            ✕
          </button>

          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg font-bold">
              +
            </span>
            <div>
              <h2 className="text-xl font-bold leading-tight">PharmaGeo</h2>
              <p className="text-xs text-blue-100">
                {mode === 'login'
                  ? 'Connectez-vous pour gérer vos précommandes'
                  : 'Rejoignez la plateforme santé de proximité'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {infoMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
              <span>🔒</span>
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Onglets Connexion / Inscription */}
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === 'register'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inscription
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                {/* Choix du profil en cartes */}
                <div>
                  <span className={labelClass}>Je suis</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('PATIENT')}
                      className={`flex flex-col items-start rounded-xl border-2 p-3 text-left transition ${
                        role === 'PATIENT'
                          ? 'border-blue-600 bg-blue-50/70'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-lg mb-1">🧑‍⚕️</span>
                      <span className="text-sm font-bold text-slate-900">Patient</span>
                      <span className="text-xs text-slate-500">
                        Rechercher & précommander
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('PHARMACIEN')}
                      className={`flex flex-col items-start rounded-xl border-2 p-3 text-left transition ${
                        role === 'PHARMACIEN'
                          ? 'border-emerald-600 bg-emerald-50/70'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-lg mb-1">🏥</span>
                      <span className="text-sm font-bold text-slate-900">Pharmacien</span>
                      <span className="text-xs text-slate-500">
                        Gérer mon officine & stock
                      </span>
                    </button>
                  </div>
                </div>

                {/* Nom & Prénom */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Nom *</label>
                    <input
                      type="text"
                      placeholder="Ex : Agnila"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Prénom</label>
                    <input
                      type="text"
                      placeholder="Ex : Naofal"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input
                    type="tel"
                    placeholder="Ex : +229 01 97 00 00 00"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            <div>
              <label className={labelClass}>Adresse email *</label>
              <input
                type="email"
                placeholder="exemple@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Mot de passe *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                  className={`${inputClass} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>

            {/* Section Officine pour Pharmacien */}
            {mode === 'register' && role === 'PHARMACIEN' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                    Informations de l’officine
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    Validation requise
                  </span>
                </div>

                <div>
                  <label className={labelClass}>Nom de la pharmacie *</label>
                  <input
                    type="text"
                    placeholder="Ex : Pharmacie Camp Guezo"
                    value={nomPharmacie}
                    onChange={(e) => setNomPharmacie(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Adresse / Quartier</label>
                  <input
                    type="text"
                    placeholder="Ex : Cotonou, Haie Vive"
                    value={adresse}
                    onChange={(e) => setAdresse(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Tél. officine</label>
                    <input
                      type="tel"
                      placeholder="Ex : 21 30 00 00"
                      value={telPharmacie}
                      onChange={(e) => setTelPharmacie(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>N° d'agrément</label>
                    <input
                      type="text"
                      placeholder="Ex : AGR-2026-014"
                      value={agrement}
                      onChange={(e) => setAgrement(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Position GPS
                    </span>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      📍 Utiliser ma position
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Latitude"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      placeholder="Longitude"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
            >
              {loading
                ? 'Traitement en cours...'
                : mode === 'login'
                ? 'Se connecter'
                : role === 'PHARMACIEN'
                ? 'Créer mon compte pharmacien'
                : 'Créer mon compte patient'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  S’inscrire maintenant
                </button>
              </>
            ) : (
              <>
                Déjà inscrit ?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Se connecter
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}