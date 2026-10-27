import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
export default function Map({ events }) {
  let ref = useRef();
  useEffect(() => {
    let pts = events
      .filter((x) => x.latitude !== null && x.longitude !== null)
      .map((x) => [Number(x.latitude), Number(x.longitude)]);
    if (!pts.length) return;
    let map = L.map(ref.current).setView(pts[0], 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    pts.forEach((p, i) =>
      L.circleMarker(p, { radius: 6, color: "#ff5b0a" })
        .addTo(map)
        .bindPopup("Punto " + (i + 1)),
    );
    if (pts.length > 1) {
      L.polyline(pts, { color: "#07346b" }).addTo(map);
      map.fitBounds(pts, { padding: [25, 25] });
    }
    return () => map.remove();
  }, [events]);
  return events.some((x) => x.latitude !== null) ? (
    <>
      <p className="hint">
        La línea une los puntos registrados; no representa necesariamente la
        ruta real.
      </p>
      <div className="map" ref={ref} />
    </>
  ) : (
    <p>Sin ubicaciones registradas.</p>
  );
}
