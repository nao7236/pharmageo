import React, { useEffect, useState } from 'react';

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('pharmageo_token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export default function PharmacienDashboard({ apiUrl, currentUser }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const [pharmacies, setPharmacies] = useState([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState('');
  const [pharmacie, setPharmacie] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [precommandes, setPrecommandes] = useState([]);

  // Édition rapide des quantités / seuils
  const [edits, setEdits] = useState({}); // { [stockId]: { quantite_disponible, seuil_alerte } }

  // Ajout d'un médicament du catalogue au stock
  const [newMedId, setNewMedId] = useState('');
  const [newQty, setNewQty] = useState(20);
  const [newSeuil, setNewSeuil] = useState(5);

  const loadDashboard = async (overridePharmacieId = selectedPharmacyId) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams({ utilisateur_id: String(currentUser.id) });
      if (overridePharmacieId) {
        params.set('pharmacie_id', String(overridePharmacieId));
      }

      const res = await fetch(`${apiUrl}/api/pharmacien/dashboard?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur chargement espace pharmacien');
      }

      setPharmacies(data.pharmacies || []);
      setPharmacie(data.pharmacie || null);
      if (data.pharmacie?.id && !overridePharmacieId) {
        setSelectedPharmacyId(String(data.pharmacie.id));
      }

      const stockList = data.stocks || [];
      setStocks(stockList);
      const initialEdits = {};
      stockList.forEach((s) => {
        const sid = String(s.id);
        initialEdits[sid] = {
          quantite_disponible: s.quantite_disponible,
          seuil_alerte: s.seuil_alerte ?? 5,
        };
      });
      setEdits(initialEdits);

      const catList = data.catalogue || [];
      setCatalogue(catList);
      if (catList.length > 0 && !newMedId) {
        setNewMedId(String(catList[0].id));
      }

      setPrecommandes(data.precommandes || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      loadDashboard();
    }
  }, [currentUser?.id]);

  const handleSelectPharmacy = (e) => {
    const id = String(e.target.value);
    setSelectedPharmacyId(id);
    setInfoMsg('');
    loadDashboard(id);
  };

  const handleToggleGarde = async () => {
    if (!pharmacie) return;
    setErrorMsg('');
    setInfoMsg('');
    const nextVal = Number(pharmacie.est_de_garde) === 1 ? 0 : 1;

    try {
      const res = await fetch(
        `${apiUrl}/api/pharmacien/pharmacies/${String(pharmacie.id)}/garde`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ est_de_garde: nextVal }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur mise à jour garde');

      setPharmacie((prev) => ({ ...prev, est_de_garde: nextVal }));
      setInfoMsg(nextVal === 1 ? 'Officine marquée DE GARDE.' : 'Officine marquée HORS GARDE.');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveStock = async (stockId) => {
    const key = String(stockId);
    const rowEdit = edits[key];
    if (!rowEdit) return;
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await fetch(`${apiUrl}/api/pharmacien/stocks/${key}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          quantite_disponible: Math.max(0, Number(rowEdit.quantite_disponible) || 0),
          seuil_alerte: Math.max(0, Number(rowEdit.seuil_alerte) || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde stock');

      setInfoMsg('Stock enregistré.');
      loadDashboard(pharmacie?.id ? String(pharmacie.id) : '');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!pharmacie?.id || !newMedId) return;
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await fetch(`${apiUrl}/api/pharmacien/stocks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          pharmacie_id: String(pharmacie.id),
          medicament_id: String(newMedId),
          quantite_disponible: Math.max(0, Number(newQty) || 0),
          seuil_alerte: Math.max(0, Number(newSeuil) || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur ajout stock');

      setInfoMsg('Médicament ajouté/mis à jour dans le stock.');
      loadDashboard(String(pharmacie.id));
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleUpdateOrderStatus = async (orderId, statut) => {
    const oid = String(orderId);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const res = await fetch(`${apiUrl}/api/pharmacien/precommandes/${oid}/statut`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ statut }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur statut précommande');

      setInfoMsg(`Précommande #${oid} passée à ${statut}.`);
      setPrecommandes((prev) =>
        prev.map((o) => (String(o.id) === oid ? { ...o, statut } : o))
      );
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Chargement de l'espace pharmacien...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-xl border border-red-300 bg-red-100 p-4 text-sm text-red-800">
          {errorMsg}
        </div>
      )}
      {infoMsg && (
        <div className="rounded-xl border border-green-300 bg-green-100 p-4 text-sm font-medium text-green-900">
          {infoMsg}
        </div>
      )}

      {/* En-tête officine + garde */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Espace Pharmacien
            </p>
            <h2 className="text-2xl font-bold text-slate-900">
              {pharmacie ? pharmacie.nom : 'Aucune officine rattachée'}
            </h2>
            {pharmacie && (
              <p className="mt-1 text-sm text-slate-600">
                {pharmacie.adresse} • Agrément :{' '}
                <span className="font-semibold">{pharmacie.statut_agrement || 'EN_ATTENTE'}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {pharmacies.length > 1 && (
              <select
                value={selectedPharmacyId}
                onChange={handleSelectPharmacy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {pharmacies.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.nom}
                  </option>
                ))}
              </select>
            )}

            {pharmacie && (
              <button
                type="button"
                onClick={handleToggleGarde}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  Number(pharmacie.est_de_garde) === 1
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                {Number(pharmacie.est_de_garde) === 1 ? '✓ De garde (Actif)' : 'Passer de garde'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Précommandes reçues */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800">
            Précommandes reçues ({precommandes.length})
          </h3>
          <button
            type="button"
            onClick={() => loadDashboard(pharmacie?.id ? String(pharmacie.id) : '')}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Actualiser
          </button>
        </div>

        {precommandes.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune précommande pour cette pharmacie.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 pr-4">#</th>
                  <th className="py-2.5 pr-4">Patient ID</th>
                  <th className="py-2.5 pr-4">Code retrait</th>
                  <th className="py-2.5 pr-4">Statut</th>
                  <th className="py-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {precommandes.map((cmd) => {
                  const oid = String(cmd.id);
                  return (
                    <tr key={oid} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold">#{oid}</td>
                      <td className="py-3 pr-4">{cmd.patient_id}</td>
                      <td className="py-3 pr-4 font-mono font-bold text-blue-700">
                        {cmd.code_retrait || '-'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                          {cmd.statut}
                        </span>
                      </td>
                      <td className="py-3">
                        <select
                          value={cmd.statut || 'EN_ATTENTE'}
                          onChange={(e) => handleUpdateOrderStatus(oid, e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                        >
                          <option value="EN_ATTENTE">EN_ATTENTE</option>
                          <option value="PRETE">PRETE</option>
                          <option value="RETIREE">RETIREE</option>
                          <option value="ANNULEE">ANNULEE</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Gestion du stock */}
      {pharmacie && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h3 className="mb-4 text-xl font-bold text-slate-800">Gestion du stock</h3>

          <form
            onSubmit={handleAddStock}
            className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4"
          >
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Médicament du catalogue
              </label>
              <select
                value={newMedId}
                onChange={(e) => setNewMedId(String(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {catalogue.map((m) => (
                  <option key={String(m.id)} value={String(m.id)}>
                    {m.nom_commercial} {m.dosage ? `(${m.dosage})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-28">
              <label className="mb-1 block text-xs font-semibold text-slate-700">Quantité</label>
              <input
                type="number"
                min="0"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="w-28">
              <label className="mb-1 block text-xs font-semibold text-slate-700">Seuil alerte</label>
              <input
                type="number"
                min="0"
                value={newSeuil}
                onChange={(e) => setNewSeuil(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Ajouter / Cumuler
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 pr-4">Médicament</th>
                  <th className="py-2.5 pr-4">Prix</th>
                  <th className="py-2.5 pr-4">Quantité</th>
                  <th className="py-2.5 pr-4">Seuil</th>
                  <th className="py-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => {
                  const sid = String(s.id);
                  const currentEdit = edits[sid] || {
                    quantite_disponible: s.quantite_disponible,
                    seuil_alerte: s.seuil_alerte ?? 5,
                  };
                  return (
                    <tr key={sid} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {s.nom_commercial}
                      </td>
                      <td className="py-3 pr-4">
                        {s.prix_indicatif ? `${Number(s.prix_indicatif).toLocaleString()} FCFA` : '-'}
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min="0"
                          value={currentEdit.quantite_disponible}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [sid]: { ...currentEdit, quantite_disponible: e.target.value },
                            }))
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2.5 py-1"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min="0"
                          value={currentEdit.seuil_alerte}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [sid]: { ...currentEdit, seuil_alerte: e.target.value },
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-300 px-2.5 py-1"
                        />
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => handleSaveStock(sid)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Enregistrer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}