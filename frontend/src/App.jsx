import React, { useEffect, useState } from 'react';
import AuthModal from './components/AuthModal';
import PharmacyMap from './components/PharmacyMap';
import PharmacienDashboard from './components/PharmacienDashboard';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = rawApiUrl.trim().replace(/\/+$/, '');

function readStoredUser() {
  try {
    const raw = localStorage.getItem('pharmageo_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function parseResponseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const preview = text.replace(/\s+/g, ' ').trim().slice(0, 140);
    throw new Error(
      `Réponse non-JSON (HTTP ${res.status}) : ${preview || 'réponse vide'}`
    );
  }
}

function isPharmacyOnDuty(p) {
  return (
    Number(p?.est_de_garde) === 1 ||
    p?.est_de_garde === true ||
    Number(p?.de_garde) === 1 ||
    p?.de_garde === true
  );
}

function getDutyScheduleLabel(p) {
  if (!p?.horaires_json) {
    return '20h00 – 08h00 (24h/24 dimanches et jours fériés)';
  }
  try {
    const parsed =
      typeof p.horaires_json === 'string'
        ? JSON.parse(p.horaires_json)
        : p.horaires_json;
    if (parsed?.garde) {
      const days = parsed.garde.jours ? `${parsed.garde.jours} : ` : '';
      return `${days}${parsed.garde.heures || '20h00 – 08h00'}`;
    }
    return '20h00 – 08h00 (24h/24 dimanches et jours fériés)';
  } catch {
    return '20h00 – 08h00 (24h/24 dimanches et jours fériés)';
  }
}

function App() {
  const [currentUser, setCurrentUser] = useState(readStoredUser);
  const [activeTab, setActiveTab] = useState(() =>
    readStoredUser()?.role === 'PHARMACIEN' ? 'pharmacien' : 'map'
  ); // 'map' | 'orders' | 'pharmacien'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState('');

  const [drugQuery, setDrugQuery] = useState('');
  const [mapCenter, setMapCenter] = useState([6.3654, 2.4183]);
  const [hasSearched, setHasSearched] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [onDutyPharmacies, setOnDutyPharmacies] = useState([]);
  const [showOnDutySection, setShowOnDutySection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [orderSuccess, setOrderSuccess] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const [myOrders, setMyOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Modale choix de paiement : "À la caisse" ou "Directement (MTN / Moov)"
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingArticles, setPendingArticles] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [paymentMode, setPaymentMode] = useState('caisse'); // 'caisse' | 'momo'
  const [momoOperator, setMomoOperator] = useState('mtn'); // 'mtn' | 'moov'
  const [momoPhone, setMomoPhone] = useState('');
  const [txConfirmation, setTxConfirmation] = useState(null);

  useEffect(() => {
    if (currentUser?.role === 'PHARMACIEN') {
      setActiveTab('pharmacien');
    } else if (activeTab === 'pharmacien') {
      setActiveTab('map');
    }
  }, [currentUser?.id, currentUser?.role]);

  const handleLogout = () => {
    localStorage.removeItem('pharmageo_token');
    localStorage.removeItem('pharmageo_user');
    setCurrentUser(null);
    setActiveTab('map');
  };

  const fetchPharmacies = (lat, lng, query = drugQuery) => {
    setMapCenter([lat, lng]);
    setErrorMsg('');
    setHasSearched(true);

    const trimmedQuery = query.trim();
    const params = new URLSearchParams({ lat, lng });
    if (trimmedQuery) {
      params.set('medicament', trimmedQuery);
      params.set('q', trimmedQuery);
    }

    fetch(`${API_URL}/api/pharmacies/search?${params.toString()}`)
      .then(async (res) => {
        const data = await parseResponseJson(res);
        if (!res.ok) {
          throw new Error(data.message || data.error || `Erreur HTTP ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        const allList = Array.isArray(data) ? data : [];
        const dutyList = allList.filter(isPharmacyOnDuty);
        setOnDutyPharmacies(dutyList);

        let matched = allList;
        if (trimmedQuery) {
          const lowerQ = trimmedQuery.toLowerCase();
          const directMatch = allList.filter(
            (p) =>
              String(p.nom || '').toLowerCase().includes(lowerQ) ||
              String(p.adresse || '').toLowerCase().includes(lowerQ) ||
              String(p.medicament || '').toLowerCase().includes(lowerQ)
          );
          if (directMatch.length > 0) {
            matched = directMatch;
          }
        }

        setPharmacies(matched);

        const anyMatchedOnDuty = matched.some(isPharmacyOnDuty);
        setShowOnDutySection(matched.length === 0 || !anyMatchedOnDuty);
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg(`Impossible de joindre l'API backend (${API_URL}) : ${err.message}`);
        setPharmacies([]);
        setOnDutyPharmacies([]);
        setShowOnDutySection(false);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const findPharmacies = (queryOverride = drugQuery) => {
    setLoading(true);
    setErrorMsg('');
    setSelectedPharmacy(null);
    setOrderSuccess('');

    if (!navigator.geolocation) {
      fetchPharmacies(6.3654, 2.4183, queryOverride);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchPharmacies(pos.coords.latitude, pos.coords.longitude, queryOverride),
      () => fetchPharmacies(6.3654, 2.4183, queryOverride)
    );
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    findPharmacies(drugQuery);
  };

  const handleSelectPharmacy = async (pharmacy) => {
    setSelectedPharmacy(pharmacy);
    setLoadingStocks(true);
    setOrderSuccess('');
    setErrorMsg('');
    setQuantities({});

    try {
      const res = await fetch(`${API_URL}/api/pharmacies/${pharmacy.id}/stocks`);
      const data = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du chargement du stock');
      }
      setStocks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setStocks([]);
    } finally {
      setLoadingStocks(false);
    }
  };

  const fetchMyOrders = async (userOverride = currentUser) => {
    setLoadingOrders(true);
    setErrorMsg('');
    try {
      const patientId = userOverride?.id || 1;
      const res = await fetch(`${API_URL}/api/precommandes?patient_id=${patientId}`);
      const data = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(data.error || 'Impossible de charger vos précommandes');
      }
      setMyOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setMyOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const openOrdersTab = () => {
    if (!currentUser) {
      setErrorMsg('');
      setAuthPromptMessage('Connectez-vous pour consulter vos précommandes.');
      setShowAuthModal(true);
      return;
    }
    setActiveTab('orders');
    fetchMyOrders(currentUser);
  };

  const handleQuantityChange = (medicamentId, value, maxStock) => {
    const key = String(medicamentId);
    const qty = Math.max(0, Math.min(Number(value) || 0, maxStock));
    setQuantities((prev) => ({
      ...prev,
      [key]: qty,
    }));
  };

  const getSelectedArticles = () => {
    return Object.entries(quantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([medicament_id, quantite]) => ({
        medicament_id: String(medicament_id),
        quantite: Number(quantite),
      }));
  };

  const calculateTotalAmount = (articles) => {
    const total = articles.reduce((sum, item) => {
      const stockItem = stocks.find(
        (s) => String(s.medicament_id ?? s.id) === String(item.medicament_id)
      );
      const unitPrice =
        Number(stockItem?.prix_indicatif) > 0
          ? Number(stockItem.prix_indicatif)
          : 1000;
      return sum + unitPrice * item.quantite;
    }, 0);

    return Math.max(100, Math.round(total));
  };

  const savePrecommande = async (articles, paymentInfo) => {
    setSubmittingOrder(true);
    setErrorMsg('');

    try {
      const token = localStorage.getItem('pharmageo_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/precommandes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patient_id: currentUser?.id || 1,
          pharmacie_id: selectedPharmacy.id,
          articles,
          paiement: paymentInfo,
        }),
      });
      const data = await parseResponseJson(res);
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la précommande');
      }

      const modeLabel =
        paymentInfo.mode === 'caisse'
          ? 'Paiement à la caisse'
          : `Paiement ${paymentInfo.operator?.toUpperCase()} (${paymentInfo.phone})`;

      const successText = `${modeLabel} — Commande #${data.precommande_id} enregistrée ! Code de retrait : ${data.code_retrait}`;
      setOrderSuccess(successText);
      setQuantities({});

      if (selectedPharmacy?.id) {
        handleSelectPharmacy(selectedPharmacy);
      }

      setTxConfirmation({
        ok: true,
        title:
          paymentInfo.mode === 'caisse'
            ? 'Commande enregistrée (paiement à la caisse)'
            : 'Transaction effectuée avec succès !',
        modeLabel,
        amount: paymentInfo.amount,
        transactionId: paymentInfo.transactionId || 'CAISSE',
        orderId: data.precommande_id,
        codeRetrait: data.code_retrait,
      });
    } catch (err) {
      console.error('Erreur savePrecommande :', err);
      setErrorMsg(err.message);
      setTxConfirmation({
        ok: false,
        title: 'Transaction non effectuée',
        detail: err.message,
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleSubmitOrder = (e) => {
    e.preventDefault();
    if (!selectedPharmacy) return;

    const articles = getSelectedArticles();
    if (articles.length === 0) {
      setErrorMsg('Choisissez au moins une quantité supérieure à 0 avant de commander.');
      return;
    }

    if (!currentUser) {
      setErrorMsg('');
      setAuthPromptMessage(
        'Veuillez vous connecter ou créer un compte patient pour finaliser votre précommande.'
      );
      setShowAuthModal(true);
      return;
    }

    setErrorMsg('');
    setOrderSuccess('');
    setTxConfirmation(null);
    setPendingArticles(articles);
    setPendingTotal(calculateTotalAmount(articles));
    setPaymentMode('caisse');
    setShowPaymentModal(true);
  };

  const handleConfirmPaymentChoice = (e) => {
    e.preventDefault();
    setTxConfirmation(null);

    if (paymentMode === 'caisse') {
      savePrecommande(pendingArticles, {
        mode: 'caisse',
        provider: 'caisse_pharmacie',
        amount: pendingTotal,
        status: 'pending_cash',
      });
      return;
    }

    const cleanPhone = momoPhone.replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      const msg = 'Veuillez saisir un numéro Mobile Money valide (MTN ou Moov).';
      setErrorMsg(msg);
      setTxConfirmation({
        ok: false,
        title: 'Transaction non effectuée',
        detail: msg,
      });
      return;
    }

    savePrecommande(pendingArticles, {
      mode: 'momo',
      operator: momoOperator,
      phone: cleanPhone,
      provider: 'fedapay_sandbox_test',
      transactionId: 'MOMO-' + Date.now(),
      amount: pendingTotal,
      status: 'approved',
    });
  };

  const visibleStocks = drugQuery.trim()
    ? stocks.filter((s) =>
        String(s.nom_commercial || '')
          .toLowerCase()
          .includes(drugQuery.trim().toLowerCase())
      )
    : stocks;

  const currentArticles = getSelectedArticles();
  const estimatedTotal = currentArticles.length > 0 ? calculateTotalAmount(currentArticles) : 0;

  const mapMarkers = hasSearched
    ? showOnDutySection
      ? onDutyPharmacies
      : pharmacies
    : [];

  const renderPharmacyCard = (p) => {
    const isSelected = String(selectedPharmacy?.id) === String(p.id);
    const isSuspended = String(p.statut || '').toUpperCase() === 'SUSPENDUE';
    const onDuty = isPharmacyOnDuty(p);
    const dutySchedule = getDutyScheduleLabel(p);

    return (
      <div
        key={p.id}
        onClick={() => handleSelectPharmacy(p)}
        className={`cursor-pointer rounded-2xl border p-4 shadow-xs transition ${
          isSelected
            ? 'border-blue-600 bg-blue-50/70'
            : 'border-slate-200 bg-white hover:border-blue-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">{p.nom}</h2>
          {isSuspended ? (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              Suspendue
            </span>
          ) : onDuty ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              De garde
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              Pas de garde
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-slate-600">{p.adresse}</p>

        <p className="mt-1.5 text-xs text-slate-700">
          <strong>Horaires de garde :</strong> {dutySchedule}
        </p>

        {p.distance !== undefined && p.distance !== null && (
          <p className="mt-1.5 text-xs font-semibold text-blue-600">
            Distance : {Number(p.distance).toFixed(2)} km
          </p>
        )}

        <p className="mt-2 text-xs font-medium text-slate-500">
          {isSelected ? '✓ Sélectionnée pour précommande' : 'Cliquer pour voir le stock'}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-600">PharmaGeo</h1>
          <p className="text-sm text-slate-600">
            Localisez une pharmacie, vérifiez la disponibilité et précommandez avec code de retrait
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUser?.role === 'PHARMACIEN' && (
            <button
              type="button"
              onClick={() => setActiveTab('pharmacien')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'pharmacien'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Espace Pharmacien
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'map'
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Carte & Recherche
          </button>

          <button
            type="button"
            onClick={openOrdersTab}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Mes précommandes
          </button>

          {currentUser ? (
            <>
              <div className="ml-2 text-right text-sm">
                <p className="font-semibold text-slate-800">
                  {[currentUser.prenom, currentUser.nom].filter(Boolean).join(' ') || currentUser.email}
                </p>
                <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {currentUser.role || 'PATIENT'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthPromptMessage('');
                setShowAuthModal(true);
              }}
              className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition"
            >
              Connexion / Inscription
            </button>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-100 p-4 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {orderSuccess && (
        <div className="mb-4 rounded-xl border border-green-300 bg-green-100 p-4 text-sm font-medium text-green-900">
          {orderSuccess}
        </div>
      )}

      {activeTab === 'pharmacien' && currentUser?.role === 'PHARMACIEN' ? (
        <PharmacienDashboard apiUrl={API_URL} currentUser={currentUser} />
      ) : activeTab === 'orders' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Mes précommandes</h2>
            <button
              type="button"
              onClick={() => fetchMyOrders(currentUser)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Actualiser
            </button>
          </div>

          {loadingOrders ? (
            <p className="text-sm text-slate-500">Chargement de vos précommandes...</p>
          ) : myOrders.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune précommande trouvée pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 pr-4">#</th>
                    <th className="py-2.5 pr-4">Pharmacie</th>
                    <th className="py-2.5 pr-4">Montant</th>
                    <th className="py-2.5 pr-4">Code de retrait</th>
                    <th className="py-2.5">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {myOrders.map((ord) => (
                    <tr key={ord.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold">#{ord.id}</td>
                      <td className="py-3 pr-4">{ord.pharmacie_nom || ord.pharmacie_id}</td>
                      <td className="py-3 pr-4 font-medium">
                        {ord.montant_total ? `${Number(ord.montant_total).toLocaleString()} FCFA` : '-'}
                      </td>
                      <td className="py-3 pr-4 font-mono font-bold text-blue-700">
                        {ord.code_retrait || '-'}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {ord.statut || 'EN_ATTENTE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <>
          <form
            onSubmit={handleSearchSubmit}
            className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <input
              type="text"
              value={drugQuery}
              onChange={(e) => setDrugQuery(e.target.value)}
              placeholder="Nom de pharmacie, quartier ou médicament (ex : Agblangandan, Paracétamol...)"
              className="min-w-[240px] flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm focus:border-blue-600 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Recherche...' : 'Rechercher'}
            </button>
            <button
              type="button"
              onClick={() => findPharmacies(drugQuery)}
              disabled={loading}
              className="rounded-xl border border-blue-600 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
            >
              📍 Autour de moi
            </button>
          </form>

          {!hasSearched ? (
            <div className="w-full">
              <PharmacyMap
                pharmacies={[]}
                selectedPharmacy={null}
                onSelectPharmacy={handleSelectPharmacy}
                center={mapCenter}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-5">
                {pharmacies.length > 0 ? (
                  <div className="space-y-3">
                    {pharmacies.map(renderPharmacyCard)}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    Aucune pharmacie ne correspond à cette recherche.
                  </div>
                )}

                {showOnDutySection && (
                  <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/80 p-4">
                    <h3 className="text-base font-bold text-amber-950">
                      Ces pharmacies sont de garde
                    </h3>
                    {onDutyPharmacies.length === 0 ? (
                      <p className="text-sm text-amber-900">
                        Aucune pharmacie de garde répertoriée pour le moment.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {onDutyPharmacies.map(renderPharmacyCard)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="lg:col-span-7">
                <PharmacyMap
                  pharmacies={mapMarkers}
                  selectedPharmacy={selectedPharmacy}
                  onSelectPharmacy={handleSelectPharmacy}
                  center={mapCenter}
                />
              </div>
            </div>
          )}

          {selectedPharmacy && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="mb-4 text-2xl font-bold text-slate-800">
                Commander à : {selectedPharmacy.nom}
              </h2>

              {loadingStocks ? (
                <p className="text-sm text-slate-500">Chargement des médicaments...</p>
              ) : visibleStocks.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aucun médicament correspondant en stock pour cette pharmacie.
                </p>
              ) : (
                <form onSubmit={handleSubmitOrder}>
                  <table className="mb-6 w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="py-2">Médicament</th>
                        <th className="py-2">Prix indicatif</th>
                        <th className="py-2">Disponible</th>
                        <th className="py-2">Quantité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStocks.map((s) => {
                        const medId = String(s.medicament_id ?? s.id);
                        return (
                          <tr key={s.id} className="border-b border-slate-100">
                            <td className="py-3 font-medium text-slate-900">{s.nom_commercial}</td>
                            <td className="py-3">
                              {s.prix_indicatif
                                ? `${Number(s.prix_indicatif).toLocaleString()} FCFA`
                                : '-'}
                            </td>
                            <td className="py-3">{s.quantite_disponible}</td>
                            <td className="py-3">
                              <input
                                type="number"
                                min="0"
                                max={s.quantite_disponible}
                                value={quantities[medId] || ''}
                                onChange={(e) =>
                                  handleQuantityChange(medId, e.target.value, s.quantite_disponible)
                                }
                                className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5"
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-700">
                      Montant estimé :{' '}
                      <span className="text-base font-bold text-slate-900">
                        {estimatedTotal.toLocaleString()} FCFA
                      </span>
                    </p>

                    <button
                      type="submit"
                      disabled={submittingOrder}
                      className="rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {submittingOrder ? 'Enregistrement...' : 'Valider la précommande'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
        </>
      )}

      {showAuthModal && (
        <AuthModal
          apiUrl={API_URL}
          infoMessage={authPromptMessage}
          onClose={() => {
            setShowAuthModal(false);
            setAuthPromptMessage('');
          }}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            setShowAuthModal(false);
            setAuthPromptMessage('');

            const articles = getSelectedArticles();
            if (selectedPharmacy && articles.length > 0 && user?.role !== 'PHARMACIEN') {
              setPendingArticles(articles);
              setPendingTotal(calculateTotalAmount(articles));
              setPaymentMode('caisse');
              setShowPaymentModal(true);
            }
          }}
        />
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                Choisir le mode de paiement ({pendingTotal.toLocaleString()} FCFA)
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            {txConfirmation ? (
              <div className="space-y-4">
                {txConfirmation.ok ? (
                  <div className="space-y-1.5 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
                    <p className="text-base font-bold">{txConfirmation.title}</p>
                    <p>Mode : <strong>{txConfirmation.modeLabel}</strong></p>
                    <p>Montant : <strong>{Number(txConfirmation.amount).toLocaleString()} FCFA</strong></p>
                    <p>Commande : <strong>#{txConfirmation.orderId}</strong></p>
                    <p>Référence : <span className="font-mono">{txConfirmation.transactionId}</span></p>
                    <p className="pt-1 text-base">
                      Code de retrait : <strong className="font-mono text-green-800">{txConfirmation.codeRetrait}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                    <p className="text-base font-bold">{txConfirmation.title}</p>
                    <p>{txConfirmation.detail}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {!txConfirmation.ok && (
                    <button
                      type="button"
                      onClick={() => setTxConfirmation(null)}
                      className="rounded-lg border px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Réessayer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmPaymentChoice} className="space-y-4">
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="paymentMode"
                      value="caisse"
                      checked={paymentMode === 'caisse'}
                      onChange={() => setPaymentMode('caisse')}
                    />
                    <div>
                      <p className="font-semibold text-slate-800">Payer à la caisse</p>
                      <p className="text-xs text-slate-500">
                        Réserve la commande et génère un code de retrait à donner à la pharmacie.
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="paymentMode"
                      value="momo"
                      checked={paymentMode === 'momo'}
                      onChange={() => setPaymentMode('momo')}
                    />
                    <div>
                      <p className="font-semibold text-slate-800">Payer directement (Mobile Money)</p>
                      <p className="text-xs text-slate-500">
                        Renseignez votre réseau MTN ou Moov et votre numéro.
                      </p>
                    </div>
                  </label>
                </div>

                {paymentMode === 'momo' && (
                  <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Réseau Mobile Money
                      </label>
                      <select
                        value={momoOperator}
                        onChange={(e) => setMomoOperator(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="mtn">MTN Mobile Money</option>
                        <option value="moov">Moov Money</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Numéro de téléphone
                      </label>
                      <input
                        type="tel"
                        value={momoPhone}
                        onChange={(e) => setMomoPhone(e.target.value)}
                        placeholder="Ex : 97000000"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="rounded-lg border px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {submittingOrder ? 'Traitement...' : 'Confirmer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;