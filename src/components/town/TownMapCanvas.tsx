"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MlMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { arcCoords, circleRing, legWidth, type MapData, type MapLeg, type MapVenue } from "@/lib/mapData";

// The WebGL layer of the town map: OpenStreetMap vector tiles from OpenFreeMap, restyled to the
// page palette, with 3D buildings, the facility as an extruded block, the 15 km Qloo radius, the
// program venues and one curved flow per active program item. Loaded only in the browser
// (next/dynamic, ssr: false); everything it shows is also in the panel beside it.

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Palette tokens (src/app/globals.css, src/app/charts.css). WebGL paint can't read CSS variables,
// so the values are read from the page at runtime, with these as the fallback.
const FALLBACK = {
  paper: "#f8f7f3",
  concrete: "#e5e4de",
  side: "#e9e8e3",
  hairline: "#cfcec7",
  rule: "#a3a29a",
  ink: "#1b1c1e",
  muted: "#4b4d50",
  qloo: "#2450d8",
  ok: "#143d2a",
  training: "#137a6c",
  procurement: "#71405a",
  grants: "#1b1c1e",
  events: "#56708c",
  channels: "#cbcac2",
};
type Palette = typeof FALLBACK;

// Base-map landscape tokens (the map block at the end of src/components/town/TownMap.css).
const MAP_FALLBACK = {
  land: "#f5f2ea",
  water: "#b4d0d8",
  shore: "#8fb2bd",
  farmland: "#efe6c6",
  grass: "#e0e8c8",
  park: "#cfe2b2",
  wood: "#bccfa6",
  residential: "#eee6da",
  commercial: "#f0e0d4",
  industrial: "#dcd7e3",
  building: "#e4dccb",
  motorway: "#e8c27e",
  motorwayCasing: "#d2a862",
  major: "#f2dca6",
  roadCasing: "#d9d3c4",
  minor: "#ffffff",
  rail: "#b3ad9f",
  label: "#55534d",
};
type MapPalette = typeof MAP_FALLBACK;

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    paper: v("--paper", FALLBACK.paper),
    concrete: v("--concrete", FALLBACK.concrete),
    side: v("--side", FALLBACK.side),
    hairline: v("--hairline", FALLBACK.hairline),
    rule: v("--rule", FALLBACK.rule),
    ink: v("--ink", FALLBACK.ink),
    muted: v("--muted", FALLBACK.muted),
    qloo: v("--band", FALLBACK.qloo),
    ok: v("--ok", FALLBACK.ok),
    training: v("--contour", FALLBACK.training),
    procurement: v("--plum", FALLBACK.procurement),
    grants: v("--ink", FALLBACK.grants),
    events: v("--slate", FALLBACK.events),
    channels: v("--side-2", FALLBACK.channels),
  };
}

function readMapPalette(el: HTMLElement): MapPalette {
  const cs = getComputedStyle(el);
  const out = { ...MAP_FALLBACK };
  for (const k of Object.keys(out) as (keyof MapPalette)[]) {
    const name = "--map-" + k.replace(/[A-Z]/g, (ch) => "-" + ch.toLowerCase());
    out[k] = cs.getPropertyValue(name).trim() || MAP_FALLBACK[k];
  }
  return out;
}

type Layer = StyleSpecification["layers"][number];
type Editable = Layer & { paint?: Record<string, unknown>; layout?: Record<string, unknown> };

// The tile source carries its own attribution (OpenFreeMap, OpenMapTiles, OpenStreetMap
// contributors), shown in full in the corner.

const polygons = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];
const landFill = (id: string, sourceLayer: string, classes: string[], color: string, minzoom = 0): Layer =>
  ({
    id,
    type: "fill",
    source: "openmaptiles",
    "source-layer": sourceLayer,
    minzoom,
    filter: ["all", polygons, ["match", ["get", "class"], classes, true, false]],
    paint: { "fill-color": color, "fill-antialias": false },
  }) as unknown as Layer;

// The base map as a landscape: warm land, lake-blue water with a deeper shoreline, wheat farmland,
// grass, park and sage wood, warm town tints with a grey-violet industrial district, amber
// motorways over pale major roads and white cased minor roads, and muted labels. The flat building
// layer is dropped for the extruded one. Every overlay colour sits on top of this unchanged.
function restyle(style: StyleSpecification, c: Palette, p: MapPalette): StyleSpecification {
  const layers: Layer[] = [];
  for (const l of style.layers) {
    const id = l.id;
    if (id === "building" || id.startsWith("landcover_ice") || id.startsWith("landcover_glacier")) continue;
    const L = structuredClone(l) as Editable;
    L.paint ??= {};
    if (id === "park") {
      // Open land under the town: farmland, then grass, then the town's own uses.
      layers.push(
        landFill("tm-farmland", "landcover", ["farmland"], p.farmland),
        landFill("tm-grass", "landcover", ["grass", "wetland"], p.grass),
        landFill("tm-commercial", "landuse", ["commercial", "retail"], p.commercial, 10),
        landFill("tm-industrial", "landuse", ["industrial", "railway", "garages", "quarry"], p.industrial, 9),
      );
    }
    if (L.type === "background") L.paint["background-color"] = p.land;
    else if (id === "water") {
      L.paint["fill-color"] = p.water;
      layers.push(L, {
        id: "tm-shore",
        type: "line",
        source: "openmaptiles",
        "source-layer": "water",
        filter: L.filter,
        paint: { "line-color": p.shore, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 1.4] },
      } as unknown as Layer);
      continue;
    } else if (id === "waterway") L.paint["line-color"] = p.shore;
    else if (id === "park") L.paint["fill-color"] = p.park;
    else if (id === "landcover_wood") L.paint["fill-color"] = p.wood;
    else if (id === "landuse_residential") L.paint["fill-color"] = p.residential;
    else if (L.type === "line" && /motorway/.test(id) && /casing/.test(id)) L.paint["line-color"] = p.motorwayCasing;
    else if (L.type === "line" && /motorway/.test(id)) {
      L.paint["line-color"] = p.motorway;
      L.paint["line-opacity"] = 1;
    } else if (L.type === "line" && /casing/.test(id)) L.paint["line-color"] = p.roadCasing;
    else if (L.type === "line" && /highway_major/.test(id)) {
      L.paint["line-color"] = p.major;
      L.paint["line-opacity"] = 1;
    } else if (L.type === "line" && /highway_minor/.test(id)) {
      // A hairline casing under each minor road, as wide as the road itself.
      const casing = structuredClone(L) as Editable;
      casing.id = "tm-minor-casing";
      casing.paint = { "line-color": p.roadCasing, "line-width": 0.8, "line-gap-width": L.paint["line-width"] };
      layers.push(casing as Layer);
      L.paint["line-color"] = p.minor;
      L.paint["line-opacity"] = 1;
    } else if (L.type === "line" && /highway_path|road_pier/.test(id)) {
      L.paint["line-color"] = p.roadCasing;
    } else if (L.type === "line" && /railway/.test(id)) {
      L.paint["line-color"] = /dashline/.test(id) ? p.land : p.rail;
    } else if (L.type === "line" && /boundary/.test(id)) L.paint["line-color"] = c.rule;
    else if (L.type === "symbol") {
      if (/shield/.test(id)) continue;
      L.paint["text-color"] = /label_(town|city|village)/.test(id) ? c.ink : p.label;
      L.paint["text-halo-color"] = p.land;
      L.paint["text-halo-width"] = 1.4;
    } else if (/aeroway/.test(id)) {
      if (L.type === "fill") L.paint["fill-color"] = p.industrial;
      else L.paint["line-color"] = p.roadCasing;
    }
    layers.push(L);
  }
  return { ...style, layers };
}

const fc = <G extends GeoJSON.Geometry>(features: GeoJSON.Feature<G>[]): GeoJSON.FeatureCollection<G> => ({ type: "FeatureCollection", features });

// The facility: a block about 360 m by 240 m around the site point, turned slightly off-grid.
function sitePolygon(lat: number, lon: number): GeoJSON.Polygon {
  const dLat = 0.18 / 110.574;
  const dLon = 0.12 / (111.32 * Math.cos((lat * Math.PI) / 180));
  const r = 0.35;
  const pts = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ].map(([x, y]) => [lon + dLon * (x * Math.cos(r) * 1.5 - y * Math.sin(r)), lat + dLat * (x * Math.sin(r) + y * Math.cos(r))]);
  return { type: "Polygon", coordinates: [pts] };
}

// Each leg bows to its own side, so two legs to one venue never overlap.
function bendOf(i: number) {
  return (i % 2 ? -1 : 1) * (0.16 + (i % 3) * 0.05);
}

interface Anim {
  t: number;
  o: number;
}

export interface CanvasProps {
  data: MapData;
  legs: MapLeg[];
  venues: Set<string>;
  showPlaces: boolean;
  focus?: string;
  hover?: string;
  resetTick: number;
  onHover: (key: string | undefined, point?: { x: number; y: number }) => void;
  onSelect: (key: string) => void;
  onPoint: (point: { x: number; y: number } | undefined) => void;
  onFail: () => void;
}

export default function TownMapCanvas({ data, legs, venues, showPlaces, focus, hover, resetTick, onHover, onSelect, onPoint, onFail }: CanvasProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const anim = useRef(new Map<string, Anim>());
  const frame = useRef<number | null>(null);
  const reduced = useRef(false);
  const palette = useRef<Palette>(FALLBACK);
  const cb = useRef({ onHover, onSelect, onPoint, onFail });
  cb.current = { onHover, onSelect, onPoint, onFail };
  const venueByKey = useRef(new Map<string, MapVenue>());
  venueByKey.current = new Map(data.venues.map((v) => [v.key, v]));
  const focusRef = useRef<string | undefined>(undefined);
  focusRef.current = focus ?? hover;

  // Overview camera: the site and every venue in frame, tilted and turned a little.
  const overview = (m: MlMap, animate: boolean) => {
    const b = new maplibregl.LngLatBounds([data.site.lon, data.site.lat], [data.site.lon, data.site.lat]);
    for (const v of data.venues) b.extend([v.lon, v.lat]);
    const cam = m.cameraForBounds(b, { padding: 56, pitch: 50, bearing: -14, maxZoom: 13.2 });
    const opts = { ...cam, pitch: 50, bearing: -14 };
    if (animate && !reduced.current) m.flyTo({ ...opts, duration: 1200, essential: false });
    else m.jumpTo(opts);
  };

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    palette.current = readPalette(el.current);
    const c = palette.current;
    const mp = readMapPalette(el.current);
    let m: MlMap | null = null;
    let cancelled = false;
    (async () => {
      let style: StyleSpecification;
      try {
        const res = await fetch(STYLE_URL);
        if (!res.ok) throw new Error(String(res.status));
        style = restyle((await res.json()) as StyleSpecification, c, mp);
      } catch {
        if (!cancelled) cb.current.onFail();
        return;
      }
      if (cancelled || !el.current) return;
      try {
        m = new maplibregl.Map({
          container: el.current,
          style,
          center: [data.site.lon, data.site.lat],
          zoom: 11,
          pitch: 50,
          bearing: -14,
          maxPitch: 70,
          attributionControl: false,
          cooperativeGestures: true,
          fadeDuration: 0,
        });
      } catch {
        cb.current.onFail();
        return;
      }
      map.current = m;
      m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      m.addControl(new maplibregl.AttributionControl({ customAttribution: "© OpenStreetMap contributors" }), "bottom-right");
      m.on("error", (e) => {
        // A missing tile or glyph is not fatal; a lost WebGL context is.
        if (/webgl/i.test(String(e.error?.message ?? ""))) cb.current.onFail();
      });
      m.on("load", () => {
        if (!m) return;
        const firstLabel = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
        // 3D buildings from the OpenStreetMap building layer.
        m.addLayer(
          {
            id: "tm-buildings",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 12.5,
            paint: {
              "fill-extrusion-color": mp.building,
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.92,
            },
          },
          firstLabel,
        );
        m.setLight({ anchor: "map", position: [1.4, 210, 40], intensity: 0.45, color: "#ffffff" });

        m.addSource("tm-radius", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: circleRing(data.site, data.radiusKm) } } });
        m.addLayer({ id: "tm-radius", type: "line", source: "tm-radius", paint: { "line-color": c.qloo, "line-width": 1.5, "line-dasharray": [3, 2], "line-opacity": 0.8 } });
        m.addLayer({
          id: "tm-radius-label",
          type: "symbol",
          source: "tm-radius",
          layout: { "symbol-placement": "line", "symbol-spacing": 420, "text-field": `${data.radiusKm} km Qloo search radius`, "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, -0.7] },
          paint: { "text-color": c.qloo, "text-halo-color": c.paper, "text-halo-width": 1.5 },
        });

        m.addSource("tm-places", { type: "geojson", data: fc(data.places.map((p) => ({ type: "Feature", properties: { name: p.name }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } }))) });
        m.addLayer({ id: "tm-places", type: "circle", source: "tm-places", layout: { visibility: "none" }, paint: { "circle-radius": 2.6, "circle-color": c.qloo, "circle-opacity": 0.35 } });

        m.addSource("tm-arcs", { type: "geojson", data: fc([]) });
        m.addLayer({
          id: "tm-arcs-casing",
          type: "line",
          source: "tm-arcs",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": c.paper, "line-width": ["+", ["get", "w"], 2.5], "line-opacity": ["*", ["get", "o"], 0.85] },
        });
        m.addLayer({
          id: "tm-arcs",
          type: "line",
          source: "tm-arcs",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["match", ["get", "bucket"], "training", c.training, "procurement", c.procurement, "grants", c.grants, "events", c.events, c.channels],
            "line-width": ["get", "w"],
            "line-opacity": ["*", ["get", "o"], ["case", ["get", "dim"], 0.25, 0.95]],
          },
        });

        // The facility site as an extruded ink block, and its label.
        m.addSource("tm-site", { type: "geojson", data: { type: "Feature", properties: {}, geometry: sitePolygon(data.site.lat, data.site.lon) } });
        m.addLayer({ id: "tm-site", type: "fill-extrusion", source: "tm-site", paint: { "fill-extrusion-color": c.ink, "fill-extrusion-height": 120, "fill-extrusion-opacity": 1 } });
        m.addSource("tm-site-pt", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [data.site.lon, data.site.lat] } } });
        m.addLayer({
          id: "tm-site-label",
          type: "symbol",
          source: "tm-site-pt",
          layout: { "text-field": data.site.label, "text-font": ["Noto Sans Bold"], "text-size": 12, "text-anchor": "top", "text-offset": [0, 1.4], "text-allow-overlap": true },
          paint: { "text-color": c.ink, "text-halo-color": c.paper, "text-halo-width": 2 },
        });

        m.addSource("tm-venues", { type: "geojson", data: fc([]), promoteId: "key" });
        m.addLayer({
          id: "tm-venues",
          type: "circle",
          source: "tm-venues",
          paint: {
            "circle-radius": ["case", ["boolean", ["feature-state", "hot"], false], 13, ["==", ["get", "kind"], "ranked"], 10, 8],
            "circle-color": ["match", ["get", "kind"], "ranked", c.qloo, "kept", c.ok, c.paper],
            "circle-stroke-color": ["match", ["get", "kind"], "unranked", c.qloo, c.paper],
            "circle-stroke-width": ["case", ["boolean", ["feature-state", "hot"], false], 3, 2],
            "circle-pitch-alignment": "viewport",
          },
        });
        m.addLayer({
          id: "tm-venue-rank",
          type: "symbol",
          source: "tm-venues",
          filter: ["has", "rank"],
          layout: { "text-field": ["to-string", ["get", "rank"]], "text-font": ["Noto Sans Bold"], "text-size": 10, "text-allow-overlap": true, "text-ignore-placement": true },
          paint: { "text-color": ["match", ["get", "kind"], "unranked", c.qloo, c.paper] },
        });
        m.addLayer({
          id: "tm-venue-label",
          type: "symbol",
          source: "tm-venues",
          layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 11.5, "text-anchor": "left", "text-offset": [1.3, 0], "text-max-width": 12, "text-optional": true },
          paint: { "text-color": c.ink, "text-halo-color": c.paper, "text-halo-width": 2 },
        });

        let hot: string | undefined;
        const setHot = (key?: string) => {
          if (hot === key) return;
          if (hot) m?.setFeatureState({ source: "tm-venues", id: hot }, { hot: false });
          hot = key;
          if (key) m?.setFeatureState({ source: "tm-venues", id: key }, { hot: true });
        };
        (m as MlMap & { __setHot?: (k?: string) => void }).__setHot = setHot;
        m.on("mousemove", "tm-venues", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          m!.getCanvas().style.cursor = "pointer";
          cb.current.onHover(String(f.properties?.key), { x: e.point.x, y: e.point.y });
        });
        m.on("mouseleave", "tm-venues", () => {
          m!.getCanvas().style.cursor = "";
          cb.current.onHover(undefined);
        });
        m.on("click", "tm-venues", (e) => {
          const f = e.features?.[0];
          if (f) cb.current.onSelect(String(f.properties?.key));
        });
        m.on("move", () => {
          const k = focusRef.current;
          const v = k ? venueByKey.current.get(k) : undefined;
          cb.current.onPoint(v ? m!.project([v.lon, v.lat]) : undefined);
        });

        overview(m, false);
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      if (frame.current) cancelAnimationFrame(frame.current);
      m?.remove();
      map.current = null;
    };
    // The map is created once per town; data changes arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Venues: only those with a visible flow (kept places always have one).
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const src = m.getSource("tm-venues") as GeoJSONSource | undefined;
    src?.setData(
      fc(
        data.venues
          .filter((v) => venues.has(v.key))
          .map((v) => ({ type: "Feature", properties: { key: v.key, name: v.name, kind: v.kind, ...(v.rank ? { rank: v.rank } : {}) }, geometry: { type: "Point", coordinates: [v.lon, v.lat] } })),
      ),
    );
  }, [ready, venues, data.venues]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setLayoutProperty("tm-places", "visibility", showPlaces ? "visible" : "none");
  }, [ready, showPlaces]);

  // Flows: legs that join draw in from the site; legs that leave fade out.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const src = m.getSource("tm-arcs") as GeoJSONSource | undefined;
    if (!src) return;
    const max = Math.max(0, ...data.lines.flatMap((l) => [...l.legs, ...(l.swap ? [l.swap] : [])]).concat(data.extras).map((l) => l.amount));
    const all = new Map<string, MapLeg>();
    for (const l of data.lines) for (const leg of [...l.legs, ...(l.swap ? [l.swap] : [])]) all.set(leg.id, leg);
    for (const leg of data.extras) all.set(leg.id, leg);
    const on = new Set(legs.map((l) => l.id));
    const a = anim.current;
    const from = new Map([...all.keys()].map((id) => [id, a.get(id) ?? { t: 0, o: 0 }]));
    const to = new Map([...all.keys()].map((id) => [id, on.has(id) ? { t: 1, o: 1 } : { t: from.get(id)!.t, o: 0 }]));
    const perVenue = new Map<string, number>();
    const geo = new Map(
      [...all.values()].map((leg) => {
        const v = venueByKey.current.get(leg.venue)!;
        const i = perVenue.get(leg.venue) ?? 0;
        perVenue.set(leg.venue, i + 1);
        return [leg.id, { leg, coords: arcCoords(data.site, v, bendOf(i)) }];
      }),
    );
    const focusKey = focus ?? hover;
    const draw = (k: number) => {
      const feats: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      for (const [id, { leg, coords }] of geo) {
        const f = from.get(id)!;
        const g = to.get(id)!;
        const t = f.t + (g.t - f.t) * k;
        const o = f.o + (g.o - f.o) * k;
        a.set(id, { t, o });
        if (o < 0.01 || t < 0.01) continue;
        const n = Math.max(2, Math.round(coords.length * t));
        feats.push({
          type: "Feature",
          properties: { id, bucket: leg.bucket, w: legWidth(leg.amount, max), o, dim: !!focusKey && leg.venue !== focusKey },
          geometry: { type: "LineString", coordinates: coords.slice(0, n) },
        });
      }
      src.setData(fc(feats));
    };
    if (frame.current) cancelAnimationFrame(frame.current);
    if (reduced.current) {
      draw(1);
      return;
    }
    const start = performance.now();
    const dur = 650;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      draw(1 - Math.pow(1 - p, 3));
      if (p < 1) frame.current = requestAnimationFrame(step);
      else frame.current = null;
    };
    frame.current = requestAnimationFrame(step);
  }, [ready, legs, data, focus, hover]);

  // Hover or focus highlights a venue; a focus from the panel moves the camera there.
  useEffect(() => {
    const m = map.current as (MlMap & { __setHot?: (k?: string) => void }) | null;
    if (!ready || !m) return;
    m.__setHot?.(focus ?? hover);
    const k = focus ?? hover;
    const v = k ? venueByKey.current.get(k) : undefined;
    cb.current.onPoint(v ? m.project([v.lon, v.lat]) : undefined);
  }, [ready, focus, hover]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !focus) return;
    const v = venueByKey.current.get(focus);
    if (!v) return;
    const opts = { center: [v.lon, v.lat] as [number, number], zoom: 15.4, pitch: 60, bearing: m.getBearing() };
    if (reduced.current) m.jumpTo(opts);
    else m.flyTo({ ...opts, duration: 1600, essential: false });
  }, [ready, focus]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !resetTick) return;
    overview(m, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, resetTick]);

  return <div ref={el} className="tm-canvas" />;
}
