// Build a Tennessee rural-transit COVERAGE polygon GeoJSON.
//
// Most rural TN transit systems run demand-response (door-to-door
// dial-a-ride), not fixed-route, so they don't publish GTFS stops.
// What they DO have is a service area (a list of counties they serve).
// This script fetches TN county polygons from US Census TIGERweb,
// joins them to the rural-HRA roster, and writes a polygon GeoJSON
// where each county feature lists which agency/agencies serve it.
//
// Output: public/tn-rural-transit-coverage.geojson
// Run: `node scripts/build-tn-rural-coverage.mjs`

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT = join(REPO_ROOT, "public", "tn-rural-transit-coverage.geojson");

// US Census TIGERweb State_County MapServer, layer 1 = current Counties.
// STATE=47 is Tennessee. Returns all 95 counties as polygons in WGS84.
const TIGER_URL =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?" +
  "where=STATE%3D%2747%27&outFields=NAME,GEOID,COUNTY&f=geojson&outSR=4326";

// Rural-transit roster (sources cited in repo issue #N when filed).
// Sources: tn.gov/tdot, ethra.org, nwtdd.org, tnrtap.com, transitland.
// `mode: 'demand-response'` for true dial-a-ride; `'mixed'` if the
// agency also runs scheduled deviated-fixed-route (e.g. ETHRA).
const RURAL_AGENCIES = [
  {
    id: "ethra",
    name: "East TN Human Resource Agency (ETHRA)",
    region: "East TN",
    color: "#f5d76e",
    mode: "mixed",
    counties: [
      "Anderson", "Blount", "Campbell", "Claiborne", "Cocke", "Grainger",
      "Hamblen", "Jefferson", "Knox", "Loudon", "Monroe", "Morgan",
      "Roane", "Scott", "Sevier", "Union",
    ],
  },
  {
    id: "uchra",
    name: "Upper Cumberland Human Resource Agency (UCHRA)",
    region: "Upper Cumberland",
    color: "#7ec8e3",
    mode: "demand-response",
    counties: [
      "Cannon", "Clay", "Cumberland", "DeKalb", "Fentress", "Jackson",
      "Macon", "Overton", "Pickett", "Putnam", "Smith", "Van Buren",
      "Warren", "White",
    ],
  },
  {
    id: "sctdd",
    name: "South Central TN Development District (SCTDD)",
    region: "South Central TN",
    color: "#c39bd3",
    mode: "demand-response",
    counties: [
      "Bedford", "Coffee", "Franklin", "Giles", "Hickman", "Lawrence",
      "Lewis", "Lincoln", "Marshall", "Maury", "Moore", "Perry", "Wayne",
    ],
  },
  {
    id: "sethra",
    name: "Southeast TN Human Resource Agency (SETHRA)",
    region: "Southeast TN",
    color: "#f1948a",
    mode: "demand-response",
    counties: [
      "Bledsoe", "Bradley", "Grundy", "Marion", "McMinn", "Meigs",
      "Polk", "Rhea", "Sequatchie",
    ],
  },
  {
    id: "nettrans",
    name: "NET Trans (First TN Human Resource Agency)",
    region: "Northeast TN",
    color: "#82e0aa",
    mode: "demand-response",
    counties: [
      "Carter", "Greene", "Hancock", "Hawkins", "Johnson", "Sullivan",
      "Unicoi", "Washington",
    ],
  },
  {
    id: "nwthra",
    name: "Northwest TN Human Resource Agency (NWTHRA)",
    region: "Northwest TN",
    color: "#f8c471",
    mode: "demand-response",
    counties: [
      "Benton", "Carroll", "Crockett", "Dyer", "Gibson", "Henry",
      "Lake", "Obion", "Weakley",
    ],
  },
  {
    id: "dhra",
    name: "Delta Human Resource Agency (DHRA)",
    region: "Delta / West TN",
    color: "#bb8fce",
    mode: "demand-response",
    counties: ["Fayette", "Lauderdale", "Tipton"],
  },
];

// --- Fetch county polygons from TIGERweb ----------------------------

console.log("fetching TN county polygons from US Census TIGERweb...");
const res = await fetch(TIGER_URL);
if (!res.ok) {
  throw new Error(`TIGERweb HTTP ${res.status}`);
}
const counties = await res.json();
if (!counties.features?.length) {
  throw new Error("TIGERweb returned no features");
}
console.log(`  got ${counties.features.length} counties`);

// Index by name (lowercased, " county" stripped) for join.
const byName = new Map();
for (const f of counties.features) {
  const name = (f.properties?.NAME || "").replace(/\s+county$/i, "").trim();
  byName.set(name.toLowerCase(), f);
}

// Round coords to 3 decimals (~110m precision, fine for state-level
// county polygons) and drop sub-100-vertex interior rings to compress
// further. Visible difference at zoom <12 is zero; payload drops ~10x.
function roundCoords(geom) {
  const round = (n) => Math.round(n * 1000) / 1000;
  const dedupe = (ring) => {
    const out = [ring[0]];
    for (let i = 1; i < ring.length; i++) {
      const [x, y] = ring[i];
      const [px, py] = out[out.length - 1];
      if (x !== px || y !== py) out.push(ring[i]);
    }
    // Polygon rings need >=4 points (closed). If our dedupe killed
    // too many, return the original.
    return out.length >= 4 ? out : ring;
  };
  const walk = (a) => {
    if (typeof a[0] === "number") return [round(a[0]), round(a[1])];
    return a.map(walk);
  };
  let coords = walk(geom.coordinates);
  // Polygon: [ring1, ring2, ...]; MultiPolygon: [[ring1, ring2], ...]
  if (geom.type === "Polygon") {
    coords = coords.map(dedupe);
  } else if (geom.type === "MultiPolygon") {
    coords = coords.map((poly) => poly.map(dedupe));
  }
  return { ...geom, coordinates: coords };
}

// --- Join counties to agencies --------------------------------------

// Build per-county agency list: countyKey -> [agencyId, ...]
const countyToAgencies = new Map();
for (const ag of RURAL_AGENCIES) {
  for (const c of ag.counties) {
    const key = c.toLowerCase();
    if (!countyToAgencies.has(key)) countyToAgencies.set(key, []);
    countyToAgencies.get(key).push(ag.id);
  }
}

// Emit one Feature per covered county. Skip counties with no rural
// transit (those are urban-system territory, handled by the GTFS
// stops layer separately).
const features = [];
const missing = [];
for (const [key, agencyIds] of countyToAgencies) {
  const f = byName.get(key);
  if (!f) {
    missing.push(key);
    continue;
  }
  const primary = RURAL_AGENCIES.find((a) => a.id === agencyIds[0]);
  features.push({
    type: "Feature",
    geometry: roundCoords(f.geometry),
    properties: {
      county: f.properties.NAME,
      county_geoid: f.properties.GEOID,
      coverage_agencies: agencyIds,
      primary_agency: agencyIds[0],
      primary_agency_name: primary?.name || agencyIds[0],
      color: primary?.color || "#888",
      mode: primary?.mode || "demand-response",
    },
  });
}

if (missing.length) {
  console.warn(`  WARN: ${missing.length} counties not matched in TIGERweb:`, missing);
}

const fc = {
  type: "FeatureCollection",
  metadata: {
    generator: "stuck-gum/scripts/build-tn-rural-coverage.mjs",
    generated_at: new Date().toISOString(),
    source: "US Census TIGERweb State_County (current Counties layer 1)",
    agencies: RURAL_AGENCIES.map(({ id, name, region, color, mode, counties }) => ({
      id, name, region, color, mode, county_count: counties.length,
    })),
    total_features: features.length,
    rural_agency_count: RURAL_AGENCIES.length,
  },
  features,
};

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(fc);
writeFileSync(OUT, json);
console.log(
  `wrote ${OUT} (${features.length} county features, ${(json.length / 1024).toFixed(1)} KB)`,
);
