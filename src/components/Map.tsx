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

// Tennessee rural-transit COVERAGE polygons. Most rural systems run
// demand-response (door-to-door dial-a-ride), no fixed routes, so
// they don't publish GTFS stops. What they DO have is a service area
// (a list of counties they serve). Built by
// scripts/build-tn-rural-coverage.mjs.
const TN_RURAL_COVERAGE_URL = "/tn-rural-transit-coverage.geojson";

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

interface RuralCoverageProps {
  county?: string;
  county_geoid?: string;
  coverage_agencies?: string[];
  primary_agency?: string;
  primary_agency_name?: string;
  color?: string;
  mode?: string;
}

interface AgencyMeta {
  id: string;
  name: string;
  region: string;
  color: string;
  gtfs?: string;
  mode?: string;
  county_count?: number;
}

interface TNMetadata {
  generator?: string;
  generated_at?: string;
  total_stops?: number;
  agencies?: AgencyMeta[];
}

interface RuralCoverageMetadata {
  generator?: string;
  generated_at?: string;
  source?: string;
  total_features?: number;
  rural_agency_count?: number;
  agencies?: AgencyMeta[];
}

export default function Map() {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [meta, setMeta] = useState<TNMetadata | null>(null);
  const [coverage, setCoverage] = useState<FeatureCollection | null>(null);
  const [coverageMeta, setCoverageMeta] = useState<RuralCoverageMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Layer visibility toggles
  const [showStops, setShowStops] = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);

  useEffect(() => {
    fetch(TN_STOPS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`stops HTTP ${r.status}`);
        return r.json();
      })
      .then((json: FeatureCollection & { metadata?: TNMetadata }) => {
        setData(json);
        if (json.metadata) setMeta(json.metadata);
      })
      .catch((e) => setError(String(e)));

    fetch(TN_RURAL_COVERAGE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`coverage HTTP ${r.status}`);
        return r.json();
      })
      .then((json: FeatureCollection & { metadata?: RuralCoverageMetadata }) => {
        setCoverage(json);
        if (json.metadata) setCoverageMeta(json.metadata);
      })
      .catch((e) => setError((prev) => (prev ? prev : String(e))));
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

        {/* Rural-transit service-area polygons (under stops, so stops draw on top). */}
        {showCoverage && coverage && (
          <GeoJSON
            key="rural-coverage"
            data={coverage as GeoJsonObject}
            style={(feature) => {
              const p = (feature?.properties || {}) as RuralCoverageProps;
              return {
                color: p.color || "#888",
                weight: 1,
                fillColor: p.color || "#888",
                fillOpacity: 0.18,
                opacity: 0.6,
              };
            }}
            onEachFeature={(feature: Feature, layer) => {
              const p = (feature.properties || {}) as RuralCoverageProps;
              const agencies = (p.coverage_agencies || []).join(", ");
              const label =
                `<b>${p.county || "(unknown)"}</b><br>` +
                `<small>${p.primary_agency_name || ""}<br>` +
                `mode: ${p.mode || "?"}<br>` +
                (agencies && agencies !== p.primary_agency
                  ? `agencies: ${agencies}`
                  : "") +
                `</small>`;
              layer.bindTooltip(label, { sticky: true });
            }}
          />
        )}

        {/* GTFS-published stops (point layer, draws on top of polygons). */}
        {showStops && data && (
          <GeoJSON
            key="stops"
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
          maxWidth: "min(90vw, 380px)",
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
          Tennessee Transit
          {data ? ` · ${data.features.length} stops` : ""}
          {coverage ? ` · ${coverage.features.length} rural-coverage counties` : ""}
          {error ? ` · ${error}` : !data && !coverage ? " · loading…" : ""}
        </div>

        {/* Layer toggles */}
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 12,
            fontSize: 11,
            color: "#d7dae0",
          }}
        >
          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={showStops}
              onChange={(e) => setShowStops(e.target.checked)}
            />
            stops
          </label>
          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={showCoverage}
              onChange={(e) => setShowCoverage(e.target.checked)}
            />
            rural coverage
          </label>
        </div>

        {/* Stops legend (fixed-route GTFS) */}
        {meta?.agencies && meta.agencies.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: "#d7dae0" }}>
            <div style={{ color: "#8a93a6", marginBottom: 2 }}>fixed-route (GTFS)</div>
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

        {/* Rural-coverage legend (demand-response) */}
        {coverageMeta?.agencies && coverageMeta.agencies.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: "#d7dae0" }}>
            <div style={{ color: "#8a93a6", marginBottom: 2 }}>
              rural service areas (demand-response)
            </div>
            {coverageMeta.agencies.map((a) => (
              <div
                key={a.id}
                style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    background: a.color,
                    opacity: 0.4,
                    border: `1px solid ${a.color}`,
                  }}
                />
                <span>
                  {a.name}{" "}
                  <span style={{ color: "#8a93a6" }}>
                    · {a.county_count} counties · {a.mode}
                  </span>
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
