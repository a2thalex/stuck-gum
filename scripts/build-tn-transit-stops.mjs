// Build a combined Tennessee transit-stops GeoJSON from public GTFS
// feeds. Run: `node scripts/build-tn-transit-stops.mjs`. Output goes
// to public/tn-transit-stops.geojson.
//
// To add more agencies: append to AGENCIES below. Each entry needs a
// direct GTFS .zip URL. Agencies behind transitland are not auto-
// resolvable here (they require API key + redirect handling); for now
// we ship the agencies whose feed URL is publicly downloadable.

import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT = join(REPO_ROOT, "public", "tn-transit-stops.geojson");

const AGENCIES = [
  {
    id: "kat",
    name: "Knoxville Area Transit (KAT)",
    region: "Knoxville",
    color: "#f5d76e",
    gtfs: "https://Knoxville.Syncromatics.com/GTFS",
  },
  {
    id: "mata",
    name: "Memphis Area Transit Authority (MATA)",
    region: "Memphis",
    color: "#3498db",
    // Direct GTFS .zip mirrored on Cad-AVL (MATA's AVL vendor).
    // Confirmed live May 12, 2026 (1.58 MB, HTTP 200).
    gtfs: "https://gtfs.mata.cadavl.com/MATA/GTFS/GTFS_MATA.zip",
  },
  // Add agencies as their direct GTFS URLs are sourced. Examples to
  // pursue: WeGo Nashville (data.nashville.gov), CARTA Chattanooga
  // (gocarta.org devs), KATS Kingsport (transitland-mirrored),
  // ETHRA, Bristol. Most need the dataset_ingest tool on Garbeast
  // w/ a transitland API key for proper redirect chasing.
];

async function downloadAndExtractStops(agency) {
  const tmp = join(tmpdir(), `gtfs-${agency.id}-${Date.now()}.zip`);
  const res = await fetch(agency.gtfs);
  if (!res.ok) throw new Error(`${agency.id}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(tmp, buf);

  // Use unzip to pull stops.txt
  const out = spawnSync("unzip", ["-p", tmp, "stops.txt"], { encoding: "utf8" });
  if (out.status !== 0) throw new Error(`unzip failed: ${out.stderr}`);
  const csv = out.stdout;

  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const idxId = header.indexOf("stop_id");
  const idxName = header.indexOf("stop_name");
  const idxLat = header.indexOf("stop_lat");
  const idxLon = header.indexOf("stop_lon");
  const idxLoc = header.indexOf("location_type"); // 0=stop, 1=station, etc.

  const features = [];
  for (const line of lines) {
    // Naive CSV parser — enough for GTFS stops.txt which rarely has
    // commas-in-quoted-fields beyond stop_name.
    const cells = parseCsvLine(line);
    const lat = parseFloat(cells[idxLat]);
    const lon = parseFloat(cells[idxLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (idxLoc >= 0 && cells[idxLoc] && cells[idxLoc] !== "0") continue; // skip stations
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        stop_id: cells[idxId],
        stop_name: cells[idxName] || "",
        agency: agency.id,
        agency_name: agency.name,
        region: agency.region,
        color: agency.color,
      },
    });
  }
  return features;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

const allFeatures = [];
for (const ag of AGENCIES) {
  console.log(`fetching ${ag.id}...`);
  try {
    const feats = await downloadAndExtractStops(ag);
    console.log(`  ${ag.id}: ${feats.length} stops`);
    allFeatures.push(...feats);
  } catch (e) {
    console.warn(`  ${ag.id}: SKIP (${e.message})`);
  }
}

const fc = {
  type: "FeatureCollection",
  metadata: {
    generator: "stuck-gum/scripts/build-tn-transit-stops.mjs",
    generated_at: new Date().toISOString(),
    agencies: AGENCIES.map(({ id, name, region, color, gtfs }) => ({ id, name, region, color, gtfs })),
    total_stops: allFeatures.length,
  },
  features: allFeatures,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(fc));
console.log(`wrote ${OUT} (${allFeatures.length} stops, ${(JSON.stringify(fc).length / 1024).toFixed(1)} KB)`);
