"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Tooltip,
} from "react-leaflet";
import type { Feature, FeatureCollection, GeoJsonObject } from "geojson";
import "leaflet/dist/leaflet.css";

const DRCOG_URL =
  "https://gis.drcog.org/server/rest/services/RDC/project_areas_2022/MapServer/0/query" +
  "?where=1%3D1&outFields=*&f=geojson&outSR=4326";

// Denver-ish center
const CENTER: [number, number] = [39.74, -104.99];
const ZOOM = 9;

const STYLE = {
  color: "#f5d76e",
  weight: 1.2,
  fillColor: "#f5d76e",
  fillOpacity: 0.18,
};

const HIGHLIGHT_STYLE = {
  color: "#ffffff",
  weight: 2,
  fillColor: "#f5d76e",
  fillOpacity: 0.45,
};

export default function Map() {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(DRCOG_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setData(json))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        scrollWheelZoom
        style={{
          height: "100%",
          width: "100%",
          background: "#0f1116",
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {data && (
          <GeoJSON
            data={data as GeoJsonObject}
            style={() => STYLE}
            onEachFeature={(feature: Feature, layer) => {
              const props = (feature.properties ?? {}) as Record<string, unknown>;
              const label =
                (props.NAME as string | undefined) ??
                (props.PROJECT_NAME as string | undefined) ??
                (props.Project_Name as string | undefined) ??
                (props.project_name as string | undefined) ??
                (props.PROJECT as string | undefined) ??
                `Feature ${feature.id ?? ""}`;
              layer.bindTooltip(String(label), { sticky: true });
              // Highlight on hover. Cast to any — leaflet's Layer base
              // type doesn't expose setStyle but Path subclasses do.
              type LayerWithStyle = { setStyle?: (s: object) => void };
              layer.on("mouseover", (e) => {
                (e.target as LayerWithStyle).setStyle?.(HIGHLIGHT_STYLE);
              });
              layer.on("mouseout", (e) => {
                (e.target as LayerWithStyle).setStyle?.(STYLE);
              });
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
          background: "rgba(15, 17, 22, 0.85)",
          color: "#f5d76e",
          padding: "10px 14px",
          borderRadius: "8px",
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
          DRCOG Project Areas (2022)
          {data
            ? ` · ${data.features.length} polygons`
            : error
            ? ` · ${error}`
            : " · loading…"}
        </div>
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
