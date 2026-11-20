import React, { useEffect, useState } from 'react';

const getMedId = (med) => med?.id ?? med?._id ?? '';

const PrecommandeForm = ({ pharmacieId, patientId = 1, medicaments = [], onSuccess }) => {
  const [file, setFile] = useState(null);
  const [selectedMedId, setSelectedMedId] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [cart, setCart] = useState([]); // [{ medicament_id, nom, prix_unitaire, quantite }]
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultCode, setResultCode] = useState('');

  useEffect(() => {
    if (medicaments.length > 0) {
      const exists = medicaments.some((m) => String(getMedId(m)) === String(selectedMedId));
      if (!selectedMedId || !exists) {
        setSelectedMedId(String(getMedId(medicaments[0])));
      }
    } else {
      setSelectedMedId('');
    }
  }, [medicaments, selectedMedId]);

  const handleAddToCart = () => {
    setErrorMsg('');
    const targetId = String(selectedMedId || getMedId(medicaments[0]) || '');
    const qty = Math.max(1, Number(quantite) || 1);
    const med = medicaments.find((m) => String(getMedId(m)) === targetId);

    if (!med || !targetId) {
      setErrorMsg('Veuillez sélectionner un médicament valide.');
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => String(item.medicament_id) === targetId);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantite: updated[existingIndex].quantite + qty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          medicament_id: targetId,
          nom: med.nom_commercial || med.nom || `Médicament #${targetId}`,
          prix_unitaire: Number(med.prix_indicatif ?? med.prix ?? 0),
          quantite: qty,
        },
      ];
    });

    setQuantite(1);
  };

  const handleRemoveItem = (medicamentId) => {
    setCart((prev) => prev.filter((item) => String(item.medicament_id) !== String(medicamentId)));
  };

  const totalFcfa = cart.reduce(
    (sum, item) => sum + Number(item.prix_unitaire || 0) * Number(item.quantite || 1),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setResultCode('');

    if (!pharmacieId) {
      setErrorMsg('Aucune pharmacie sélectionnée.');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('Ajoutez au moins un médicament au panier avant de valider.');
      return;
    }

    setLoading(true);
    try {
      const articlesPayload = cart.map(({ medicament_id, quantite: q }) => ({
        medicament_id: String(medicament_id),
        quantite: Number(q) || 1,
      }));

      let response;
      if (file) {
        const formData = new FormData();
        formData.append('patient_id', String(patientId));
        formData.append('pharmacie_id', String(pharmacieId));
        formData.append('ordonnance', file);
        formData.append('articles', JSON.stringify(articlesPayload));

        response = await fetch('http://localhost:5000/api/precommandes', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('http://localhost:5000/api/precommandes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: patientId,
            pharmacie_id: pharmacieId,
            url_ordonnance: null,
            articles: articlesPayload,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erreur lors de la précommande.');
      }

      setResultCode(data.code_retrait || '');
      setCart([]);
      setFile(null);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Impossible de soumettre la précommande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow-md space-y-4">
      <h2 className="text-xl font-bold">Nouvelle Précommande</h2>

      {errorMsg && (
        <div className="p-3 rounded bg-red-100 text-red-800 text-sm">{errorMsg}</div>
      )}

      {resultCode && (
        <div className="p-3 rounded bg-green-100 text-green-800 text-sm font-medium">
          Précommande enregistrée ! Code de retrait : <strong>{resultCode}</strong>
        </div>
      )}

      {/* Sélection médicament + quantité */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm font-medium mb-1">Médicament</label>
          <select
            value={selectedMedId}
            onChange={(e) => setSelectedMedId(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {medicaments.map((med) => {
              const id = String(getMedId(med));
              return (
                <option key={id} value={id}>
                  {med.nom_commercial || med.nom} — {Number(med.prix_indicatif ?? med.prix ?? 0)} FCFA
                </option>
              );
            })}
          </select>
        </div>

        <div className="w-24">
          <label className="block text-sm font-medium mb-1">Qté</label>
          <input
            type="number"
            min="1"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Ajouter
        </button>
      </div>

      {/* Liste du panier */}
      {cart.length > 0 && (
        <div className="border rounded p-3 space-y-2 bg-gray-50">
          <div className="text-sm font-semibold">Panier :</div>
          {cart.map((item) => (
            <div key={item.medicament_id} className="flex justify-between items-center text-sm">
              <span>
                {item.nom} × {item.quantite} ({item.prix_unitaire * item.quantite} FCFA)
              </span>
              <button
                type="button"
                onClick={() => handleRemoveItem(item.medicament_id)}
                className="text-red-600 hover:underline"
              >
                Retirer
              </button>
            </div>
          ))}
          <div className="pt-2 border-t font-bold text-right">
            Total estimé : {totalFcfa} FCFA
          </div>
        </div>
      )}

      {/* Ordonnance optionnelle */}
      <div>
        <label className="block text-sm font-medium mb-1">Ordonnance (optionnel)</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? 'Envoi en cours...' : 'Valider'}
      </button>
    </form>
  );
};

export default PrecommandeForm;