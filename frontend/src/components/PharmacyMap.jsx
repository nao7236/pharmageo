import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

function getHoraireGardeText(pharmacie) {
  if (!pharmacie?.horaires_json) {
    return '20h00 – 08h00 (Permanence de garde)';
  }
  try {
    const parsed =
      typeof pharmacie.horaires_json === 'string'
        ? JSON.parse(pharmacie.horaires_json)
        : pharmacie.horaires_json;
    if (parsed?.garde) {
      const jours = parsed.garde.jours ? `${parsed.garde.jours} : ` : '';
      return `${jours}${parsed.garde.heures || '20h00 – 08h00'}`;
    }
    return '20h00 – 08h00 (Permanence de garde)';
  } catch {
    return '20h00 – 08h00 (Permanence de garde)';
  }
}

export default function PharmacyMap({
  pharmacies = [],
  selectedPharmacy,
  onSelectPharmacy,
  center = [6.3654, 2.4183],
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current).setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const validPoints = [];

    pharmacies.forEach((p) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      validPoints.push([lat, lng]);
      const isSelected = selectedPharmacy?.id === p.id;
      const isOnDuty = Number(p.est_de_garde) === 1 || p.est_de_garde === true;

      const marker = L.circleMarker([lat, lng], {
        radius: isSelected ? 11 : 8,
        fillColor: isSelected ? '#16a34a' : isOnDuty ? '#d97706' : '#2563eb',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });

      const gardeBadge = isOnDuty
        ? `<br/><span style="color:#b45309;font-weight:600;">De garde — ${getHoraireGardeText(p)}</span>`
        : `<br/><span style="color:#475569;">Horaires de garde : ${getHoraireGardeText(p)}</span>`;

      marker.bindPopup(
        `<strong>${p.nom || 'Pharmacie'}</strong><br/>${p.adresse || ''}${gardeBadge}`
      );
      marker.on('click', () => {
        onSelectPharmacy?.(p);
      });
      marker.addTo(layer);
    });

    if (
      selectedPharmacy &&
      Number.isFinite(Number(selectedPharmacy.latitude)) &&
      Number.isFinite(Number(selectedPharmacy.longitude))
    ) {
      map.setView([Number(selectedPharmacy.latitude), Number(selectedPharmacy.longitude)], 14, {
        animate: true,
      });
    } else if (validPoints.length > 0) {
      map.fitBounds(validPoints, { padding: [30, 30], maxZoom: 14 });
    }
  }, [pharmacies, selectedPharmacy, onSelectPharmacy]);

  return (
    <div
      ref={mapContainerRef}
      className="h-[380px] w-full rounded-2xl border border-slate-200 shadow-xs z-10"
    />
  );
}