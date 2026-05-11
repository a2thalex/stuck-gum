"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection, GeoJsonObject, Point } from "geojson";
import "leaflet/dist/leaflet.css";

// Tennessee transit stops, combined from public GTFS feeds. Built by
// scripts/build-tn-transit-stops.mjs and committed to /public.
// Currently includes Knoxville KAT (720 stops); add more agencies in
// the builder script as their direct GTFS URLs are sourced.
const TN_STOPS_URL = "/tn-transit-stops.geojson";

// Center on Tennessee
const CENTER: [number, number] = [35.86, -86.66];
const ZOOM = 7;

interface TNStopProps {
  stop_id?: string;
  stop_name?: string;
  agency?: string;
  agency_name?: string;
  region?: string;
  color?: string;
}

interface TNMetadata {
  generator?: string;
  generated_at?: string;
  total_stops?: number;
  agencies?: Array<{
    id: string;
    name: string;
    region: string;
    color: string;
    gtfs: string;
  }>;
}

export default function Map() {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [meta, setMeta] = useState<TNMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(TN_STOPS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: FeatureCollection & { metadata?: TNMetadata }) => {
        setData(json);
        if (json.metadata) setMeta(json.metadata);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", background: "#0f1116" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {data && (
          <GeoJSON
            data={data as GeoJsonObject}
            pointToLayer={(feature: Feature<Point>, latlng) => {
              const p = (feature.properties || {}) as TNStopProps;
              return L.circleMarker(latlng, {
                radius: 4,
                color: p.color || "#f5d76e",
                weight: 1,
                fillColor: p.color || "#f5d76e",
                fillOpacity: 0.7,
              });
            }}
            onEachFeature={(feature: Feature, layer) => {
              const p = (feature.properties || {}) as TNStopProps;
              const label = `${p.stop_name || "(unnamed)"}<br><small>${p.agency_name || p.agency || ""}</small>`;
              layer.bindTooltip(label, { sticky: true });
            }}
          />
        )}
      </MapContainer>

      <header
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 1000,
          background: "rgba(15, 17, 22, 0.88)",
          color: "#f5d76e",
          padding: "12px 16px",
          borderRadius: 8,
          fontFamily:
            "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
          backdropFilter: "blur(6px)",
          border: "1px solid #2a3040",
          maxWidth: "min(90vw, 360px)",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Stuck Gum
        </div>
        <div style={{ fontSize: 11, color: "#8a93a6", marginTop: 4 }}>
          Tennessee Transit Stops
          {data
            ? ` · ${data.features.length} stops`
            : error
            ? ` · ${error}`
            : " · loading…"}
        </div>
        {meta?.agencies && meta.agencies.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#d7dae0" }}>
            {meta.agencies.map((a) => (
              <div
                key={a.id}
                style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: a.color,
                  }}
                />
                <span>
                  {a.name} · <span style={{ color: "#8a93a6" }}>{a.region}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </header>

      <footer
        style={{
          position: "absolute",
          bottom: 8,
          right: 12,
          zIndex: 1000,
          fontSize: 10,
          color: "#5a6172",
          fontFamily:
            "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
          background: "rgba(15, 17, 22, 0.7)",
          padding: "3px 8px",
          borderRadius: 4,
        }}
      >
        next.js · leaflet · garbeast claude bridge
      </footer>
    </div>
  );
}
