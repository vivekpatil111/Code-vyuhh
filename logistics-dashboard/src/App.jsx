import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ═══════════════════════════════════════════════════════════════════════════════
// LIGHT THEME — matching screenshot palette
// ═══════════════════════════════════════════════════════════════════════════════
const C = {
  pageBg:   "#eaf7f0",
  surface:  "#ffffff",
  card:     "#f7fdfa",
  border:   "#d0ece3",
  teal:     "#1aab8a",
  tealDark: "#148a6e",
  tealBg:   "#1aab8a",
  tealLight:"#e6f7f2",
  accent:   "#f59e0b",
  red:      "#e53935",
  blue:     "#1e88e5",
  purple:   "#7c3aed",
  orange:   "#f97316",
  green:    "#16a34a",
  text:     "#1a2e2a",
  muted:    "#5a7a72",
  dim:      "#d0ece3",
  white:    "#ffffff",
  navBg:    "#ffffff",
  navBorder:"#e0ede8",
};

// ═══════════════════════════════════════════════════════════════════════════════
// BASE DATA
// ═══════════════════════════════════════════════════════════════════════════════
const TRIPS_BASE = [
  { id:"TRK-001", from:"Delhi",     to:"Mumbai",    progress:0.32, status:"ON_ROUTE", driver:"Rajesh Kumar",   cargo:"Electronics",  weight:8.4, distance:1420, speed:62, fuel:68, delay:0,  eta:480 },
  { id:"TRK-042", from:"Mumbai",    to:"Bangalore", progress:0.65, status:"AT_RISK",  driver:"Sunil Patil",    cargo:"Pharmaceuticals",weight:5.2,distance:980, speed:54, fuel:51, delay:22, eta:198 },
  { id:"VAN-017", from:"Delhi",     to:"Kolkata",   progress:0.18, status:"DELAYED",  driver:"Anita Rao",      cargo:"FMCG Goods",   weight:3.8, distance:1470, speed:48, fuel:74, delay:47, eta:820 },
  { id:"TRK-088", from:"Hyderabad", to:"Chennai",   progress:0.80, status:"ON_ROUTE", driver:"Mohan Das",      cargo:"Textiles",     weight:6.1, distance:620,  speed:71, fuel:42, delay:0,  eta:88  },
  { id:"VAN-031", from:"Ahmedabad", to:"Delhi",     progress:0.52, status:"AT_RISK",  driver:"Priya Sharma",   cargo:"Auto Parts",   weight:7.3, distance:940,  speed:57, fuel:59, delay:18, eta:310 },
  { id:"TRK-055", from:"Kolkata",   to:"Nagpur",    progress:0.40, status:"ON_ROUTE", driver:"Vikram Tiwari",  cargo:"Steel Coils",  weight:14.2,distance:1190, speed:55, fuel:62, delay:0,  eta:520 },
  { id:"VAN-099", from:"Chennai",   to:"Hyderabad", progress:0.71, status:"DELAYED",  driver:"Deepa Menon",    cargo:"Perishables",  weight:2.9, distance:630,  speed:44, fuel:38, delay:35, eta:142 },
  { id:"TRK-112", from:"Pune",      to:"Nagpur",    progress:0.55, status:"ON_ROUTE", driver:"Amit Joshi",     cargo:"Machine Parts",weight:9.8, distance:590,  speed:60, fuel:55, delay:0,  eta:230 },
  { id:"VAN-204", from:"Jaipur",    to:"Mumbai",    progress:0.38, status:"AT_RISK",  driver:"Kavita Singh",   cargo:"Garments",     weight:2.4, distance:1150, speed:52, fuel:66, delay:14, eta:430 },
];

const INITIAL_RISK_MATRIX = {
  "TRK-001": { route:38, weather:22, traffic:55, mech:18, fatigue:42, cargo:65, toll:28 },
  "TRK-042": { route:72, weather:81, traffic:58, mech:34, fatigue:60, cargo:28, toll:45 },
  "VAN-017": { route:88, weather:52, traffic:76, mech:29, fatigue:82, cargo:40, toll:62 },
  "TRK-088": { route:22, weather:60, traffic:28, mech:78, fatigue:35, cargo:55, toll:18 },
  "VAN-031": { route:65, weather:38, traffic:82, mech:48, fatigue:30, cargo:72, toll:40 },
  "TRK-055": { route:32, weather:20, traffic:42, mech:62, fatigue:70, cargo:48, toll:82 },
  "VAN-099": { route:78, weather:68, traffic:58, mech:22, fatigue:50, cargo:40, toll:35 },
  "TRK-112": { route:28, weather:32, traffic:38, mech:55, fatigue:28, cargo:60, toll:22 },
  "VAN-204": { route:60, weather:44, traffic:72, mech:30, fatigue:40, cargo:28, toll:48 },
};

const RISK_LABELS = [
  { key:"route",   icon:"🗺️", label:"Route Risk",      rec:"Consider NH-48 alternate via Pune bypass" },
  { key:"weather", icon:"🌧️", label:"Weather Risk",   rec:"Monitor IMD; carry weatherproofing kit" },
  { key:"traffic", icon:"🚦", label:"Traffic Risk",   rec:"Depart before 06:00 to bypass peak hours" },
  { key:"mech",    icon:"⚙️", label:"Mechanical Risk",rec:"Schedule preventive service before next trip" },
  { key:"fatigue", icon:"😴", label:"Driver Fatigue",  rec:"Mandatory 6 hr rest; trigger relief driver" },
  { key:"cargo",   icon:"📦", label:"Cargo Risk",      rec:"Verify packaging integrity at next checkpoint" },
  { key:"toll",    icon:"🛂", label:"Toll/Border Risk", rec:"Pre-load FASTag balance; avoid cash lanes" },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE DATA ENGINE — realistic dynamic shifts for EVERYTHING
// ═══════════════════════════════════════════════════════════════════════════════
function useLiveData() {
  const [trips, setTrips]   = useState(TRIPS_BASE.map(t => ({ ...t })));
  const [kpis,  setKpis]    = useState({ activeTrips:186, atRisk:26, delayed:11, avgDelay:28, carbonT:2.29 });
  const [orders, setOrders] = useState({ delivered:4821, inTransit:186, pending:347 });
  const [envData, setEnvData] = useState({ temp: 24.2, humidity: 58, bandwidth: 2.4, capacity: 82 });
  const [bizMetrics, setBizMetrics] = useState({ onTimeRate: 94.2, costPerKm: 11.8, satisfaction: 4.8 });
  const [dynamicRisks, setDynamicRisks] = useState(INITIAL_RISK_MATRIX);
  
  const [history, setHistory] = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      time: `${(8 + Math.floor(i / 4)).toString().padStart(2, "0")}:${(i % 4 * 15).toString().padStart(2, "0")}`,
      deliveries: 180 + Math.round(Math.random() * 40),
      delayed: 8 + Math.round(Math.random() * 8),
      fuel: 62 + Math.round(Math.random() * 18),
      co2: 1.8 + Math.random() * 0.8,
      revenue: 280 + Math.round(Math.random() * 80),
      optimal: 330 + Math.round(Math.random() * 60),
    }))
  );
  const [agentLog, setAgentLog] = useState([]);
  const [alerts, setAlerts]    = useState([]);
  const [tick, setTick]        = useState(0);
  const tickRef = useRef(0);

  const AGENT_EVENTS = [
    (t) => ({ agent:"ROUTE-AGENT",   color:C.blue,   icon:"🗺️", msg:`Rerouted ${t} via NH-48 Pune bypass — congestion reduced`, impact:"−24 min ETA", conf:92 }),
    (t) => ({ agent:"RISK-AGENT",    color:C.red,    icon:"⚠️", msg:`${t} flagged: 68% delay probability — weather + traffic`, impact:"Alert raised",  conf:85 }),
    (t) => ({ agent:"FUEL-AGENT",    color:C.orange, icon:"⛽", msg:`${t} fuel efficiency drop detected — tyre pressure low?`,  impact:"Save ₹320",    conf:78 }),
    (t) => ({ agent:"SUSTAIN-AGENT", color:C.green,  icon:"🌿", msg:`${t} switched to EV-priority corridor — NH-44 green zone`, impact:"−16 kg CO₂",  conf:90 }),
  ];

  const ALERT_MSGS = [
    "⚠️ TRK-042 — rain on NH-4: speed restricted to 50 km/h",
    "🔴 VAN-017 delayed 47 min — NH-2 accident near Varanasi",
    "⚠️ VAN-031 — tyre pressure low alert at WH-Ahmedabad",
    "🌧️ IMD warning: heavy rain in Maharashtra for next 6 hrs",
  ];

  useEffect(() => {
    // Seed initial agents and alerts
    setAgentLog(Array.from({ length: 4 }, (_, i) => ({ ...AGENT_EVENTS[i % 4](TRIPS_BASE[i].id), id: i, time: new Date(Date.now() - (4 - i) * 18000).toLocaleTimeString() })));
    setAlerts([{ id: 1, msg: ALERT_MSGS[1] }]);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      tickRef.current += 1;
      const n = tickRef.current;
      setTick(n);

      // 1. UPDATE TRIPS
      setTrips(prev => prev.map(t => {
        const newSpeed   = clamp(t.speed + (Math.random() - 0.5) * 4, 35, 90);
        const newFuel    = clamp(t.fuel - (Math.random() * 0.3), 5, 100);
        const progDelta  = (newSpeed / 1000) * (3 / 3600); 
        const newProg    = Math.min(t.progress + progDelta * 0.8, 0.99);
        const newEta     = Math.max(0, t.eta - Math.round(Math.random() * 0.8));
        return { ...t, speed: +newSpeed.toFixed(1), fuel: +newFuel.toFixed(1), progress: +newProg.toFixed(4), eta: newEta };
      }));

      // 2. UPDATE KPIs & ORDERS (Micro-drifts)
      setKpis(prev => ({
        activeTrips: clamp(prev.activeTrips + (n % 40 === 0 ? Math.floor(Math.random() * 3) - 1 : 0), 180, 195),
        atRisk:      clamp(prev.atRisk      + (n % 30 === 0 ? Math.floor(Math.random() * 3) - 1 : 0), 18, 35),
        delayed:     clamp(prev.delayed     + (n % 50 === 0 ? Math.floor(Math.random() * 2) - 1 : 0), 6, 18),
        avgDelay:    clamp(prev.avgDelay    + (Math.random() - 0.5) * 0.5, 20, 45),
        carbonT:     +(prev.carbonT         + (Math.random() - 0.48) * 0.005).toFixed(3),
      }));
      setOrders(prev => ({
        delivered:  prev.delivered  + (n % 8 === 0 ? Math.floor(Math.random() * 3) + 1 : 0),
        inTransit:  clamp(prev.inTransit + (n % 12 === 0 ? Math.floor(Math.random() * 3) - 1 : 0), 170, 200),
        pending:    clamp(prev.pending   + (n % 15 === 0 ? Math.floor(Math.random() * 5) - 2 : 0), 320, 380),
      }));

      // 3. UPDATE ENV & BIZ METRICS (Makes side panels alive)
      setEnvData(prev => ({
        temp: +(prev.temp + (Math.random() - 0.5) * 0.4).toFixed(1),
        humidity: clamp(prev.humidity + Math.round((Math.random() - 0.5) * 2), 40, 90),
        bandwidth: +(prev.bandwidth + (Math.random() - 0.45) * 0.6).toFixed(2),
        capacity: clamp(prev.capacity + (n % 10 === 0 ? Math.round((Math.random()-0.5)*2) : 0), 60, 95)
      }));
      setBizMetrics(prev => ({
        onTimeRate: clamp(prev.onTimeRate + (Math.random() - 0.48) * 0.05, 88.0, 98.0),
        costPerKm: clamp(prev.costPerKm + (Math.random() - 0.5) * 0.1, 10.5, 13.5),
        satisfaction: clamp(prev.satisfaction + (Math.random() - 0.48) * 0.01, 4.2, 4.9)
      }));

      // 4. UPDATE RISK MATRIX (Makes Risk Analyser progress bars move live)
      setDynamicRisks(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (Math.random() > 0.6) { // Only update some trucks per tick so it feels organic
            next[key] = { ...next[key] };
            Object.keys(next[key]).forEach(factor => {
              next[key][factor] = clamp(next[key][factor] + Math.round((Math.random() - 0.5) * 3), 5, 95);
            });
          }
        });
        return next;
      });

      // 5. UPDATE HISTORY CHART (Every 20 ticks)
      if (n % 20 === 0) {
        setHistory(prev => {
          const now = new Date();
          const label = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
          const last = prev[prev.length - 1];
          return [...prev.slice(-23), {
            time: label,
            deliveries: clamp(last.deliveries + Math.round((Math.random()-0.5)*8), 160, 230),
            delayed:    clamp(last.delayed    + Math.round((Math.random()-0.5)*3), 5, 20),
            fuel:       clamp(last.fuel       + Math.round((Math.random()-0.5)*5), 55, 90),
            co2:        +(last.co2            + (Math.random()-0.48)*0.05).toFixed(2),
            revenue:    clamp(last.revenue    + Math.round((Math.random()-0.45)*15), 240, 380),
            optimal:    clamp(last.optimal    + Math.round((Math.random()-0.45)*12), 300, 420),
          }];
        });
      }
    }, 3000); 
    return () => clearInterval(iv);
  }, []);

  return { trips, kpis, orders, history, agentLog, alerts, tick, envData, bizMetrics, dynamicRisks };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-WORLD ROUTING GRAPH (NODES & EDGES)
// ═══════════════════════════════════════════════════════════════════════════════
const CITIES_LATLNG = {
  Delhi:     { lat: 28.6139, lng: 77.2090 },
  Mumbai:    { lat: 19.0760, lng: 72.8777 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Chennai:   { lat: 13.0827, lng: 80.2707 },
  Kolkata:   { lat: 22.5726, lng: 88.3639 },
  Hyderabad: { lat: 17.3850, lng: 78.4867 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Pune:      { lat: 18.5204, lng: 73.8567 },
  Nagpur:    { lat: 21.1458, lng: 79.0882 },
  Lucknow:   { lat: 26.8467, lng: 80.9462 },
  Jaipur:    { lat: 26.9124, lng: 75.7873 },
  Surat:     { lat: 21.1702, lng: 72.8311 },
};

const HIGHWAYS = [
  ["Delhi", "Jaipur"], ["Delhi", "Lucknow"], ["Jaipur", "Ahmedabad"],
  ["Ahmedabad", "Surat"], ["Surat", "Mumbai"], ["Mumbai", "Pune"],
  ["Pune", "Bangalore"], ["Pune", "Hyderabad"], ["Pune", "Nagpur"],
  ["Bangalore", "Chennai"], ["Bangalore", "Hyderabad"], ["Hyderabad", "Chennai"],
  ["Hyderabad", "Nagpur"], ["Nagpur", "Kolkata"], ["Nagpur", "Lucknow"],
  ["Lucknow", "Kolkata"]
];

const getDistance = (c1, c2) => {
  const R = 6371; 
  const dLat = (c2.lat - c1.lat) * (Math.PI / 180);
  const dLng = (c2.lng - c1.lng) * (Math.PI / 180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(c1.lat * (Math.PI / 180)) * Math.cos(c2.lat * (Math.PI / 180)) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

function findOptimalPath(startCity, targetCity, useHeuristic = false) {
  if (!CITIES_LATLNG[startCity] || !CITIES_LATLNG[targetCity]) return [];
  const graph = {};
  Object.keys(CITIES_LATLNG).forEach(c => graph[c] = []);
  HIGHWAYS.forEach(([a, b]) => {
    const dist = getDistance(CITIES_LATLNG[a], CITIES_LATLNG[b]);
    graph[a].push({ node: b, cost: dist });
    graph[b].push({ node: a, cost: dist });
  });

  const distances = {};
  const previous = {};
  const queue = [];

  Object.keys(graph).forEach(n => { distances[n] = Infinity; previous[n] = null; });
  distances[startCity] = 0;
  queue.push({ node: startCity, priority: 0 });

  while (queue.length > 0) {
    queue.sort((a, b) => a.priority - b.priority);
    const current = queue.shift().node;
    if (current === targetCity) break;
    graph[current].forEach(neighbor => {
      const trafficPenalty = (current === "Nagpur" || neighbor.node === "Nagpur") ? 150 : 0; 
      const newCost = distances[current] + neighbor.cost + trafficPenalty;
      if (newCost < distances[neighbor.node]) {
        distances[neighbor.node] = newCost;
        previous[neighbor.node] = current;
        const heuristic = useHeuristic ? getDistance(CITIES_LATLNG[neighbor.node], CITIES_LATLNG[targetCity]) : 0;
        queue.push({ node: neighbor.node, priority: newCost + heuristic });
      }
    });
  }

  const path = [];
  let curr = targetCity;
  while (curr) { path.unshift(CITIES_LATLNG[curr]); curr = previous[curr]; }
  return path;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function LeafletMap({ trips }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);

  useEffect(() => {
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([22.0, 79.0], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(mapInstance.current);
      layerGroup.current = L.layerGroup().addTo(mapInstance.current);

      HIGHWAYS.forEach(([a, b]) => {
        L.polyline([CITIES_LATLNG[a], CITIES_LATLNG[b]], { color: '#cbd5e1', weight: 2, dashArray: '5, 5', opacity: 0.6 }).addTo(mapInstance.current);
      });
    }

    layerGroup.current.clearLayers();
    trips.forEach(t => {
      if (!CITIES_LATLNG[t.from] || !CITIES_LATLNG[t.to]) return;
      
      const dijkstraPath = findOptimalPath(t.from, t.to, false);
      if (dijkstraPath.length > 0) L.polyline(dijkstraPath, { color: C.blue, weight: 4, opacity: 0.7 }).addTo(layerGroup.current);

      const aStarPath = findOptimalPath(t.from, t.to, true);
      if (aStarPath.length > 0) L.polyline(aStarPath, { color: C.purple, weight: 4, dashArray: '10, 10', opacity: 0.9 }).addTo(layerGroup.current);

      const p = Math.min(t.progress, 0.99);
      const start = CITIES_LATLNG[t.from], end = CITIES_LATLNG[t.to];
      const currentLat = start.lat + (end.lat - start.lat) * p;
      const currentLng = start.lng + (end.lng - start.lng) * p;
      const color = t.status === "ON_ROUTE" ? C.green : t.status === "AT_RISK" ? C.accent : C.red;
      
      const truckIcon = L.divIcon({
        className: "custom-truck",
        html: `<div style="background:${color}; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:12px; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);">🚛</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      });

      L.marker([currentLat, currentLng], { icon: truckIcon })
        .bindPopup(`<div style="font-family: 'Sora', sans-serif;"><strong>${t.id}</strong><br><span style="color: #5a7a72; font-size: 11px;">${t.from} &rarr; ${t.to}</span><br>Status: <span style="color: ${color}; font-weight: bold;">${t.status.replace("_", " ")}</span></div>`)
        .addTo(layerGroup.current);
    });
  }, [trips]); 

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🗺️ Routing AI: Dijkstra vs A*</div>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 10, color: C.blue, fontWeight: 600 }}>▬ Dijkstra</span>
          <span style={{ fontSize: 10, color: C.purple, fontWeight: 600 }}>--- A* Route</span>
        </div>
      </div>
      <div ref={mapRef} style={{ width: "100%", height: 340, borderRadius: 8, zIndex: 0 }}></div>
    </div>
  );
}

const Tag = ({ color, label }) => <span style={{ background: color + "18", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "1.5px 7px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>;
const SHead = ({ title, icon }) => <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><span>{icon}</span>{title}</div>;
const LiveDot = ({ color }) => (
  <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
    <div style={{ position: "absolute", inset: -2, borderRadius: "50%", border: `2px solid ${color}`, animation: "ping 1.5s ease-out infinite", opacity: 0 }} />
  </div>
);

function KpiStrip({ kpis }) {
  const cards = [
    { label: "Active Trips",      value: kpis.activeTrips, suffix: "",    color: C.teal,   icon: "🚛", bg: C.teal },
    { label: "At Risk",           value: kpis.atRisk,      suffix: "",    color: C.teal,   icon: "⚠️", bg: C.teal },
    { label: "Delayed Vehicles",  value: kpis.delayed,     suffix: "",    color: C.teal,   icon: "🔴", bg: C.teal },
    { label: "Carbon Emission",   value: kpis.carbonT.toFixed(2)+"T", suffix: "", color:C.teal, icon:"🌿", bg: C.teal },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
      {cards.map(k => (
        <div key={k.label} style={{ background: C.tealBg, borderRadius: 14, padding: "22px 24px", color: C.white, boxShadow: "0 4px 16px #1aab8a30" }}>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 10 }}>{k.label}</div>
          <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

function AgenticFeed({ log }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <SHead title="Agentic AI Feed" icon="🤖" />
      <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 280, overflowY: "auto" }}>
        {log.map((e, i) => (
          <div key={e.id} style={{ background: e.color + "0d", border: `1px solid ${e.color}30`, borderRadius: 10, padding: "9px 11px", animation: i === 0 ? "fadeIn 0.4s ease" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: e.color, letterSpacing: 0.8 }}>{e.icon} {e.agent}</span>
              <span style={{ fontSize: 9.5, color: C.muted, fontFamily: "DM Mono" }}>{e.time}</span>
            </div>
            <div style={{ fontSize: 11, color: C.text, lineHeight: 1.45, marginBottom: 3 }}>{e.msg}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ fontSize: 9.5, color: C.green, fontWeight: 600 }}>↯ {e.impact}</span>
              <span style={{ fontSize: 9.5, color: C.muted }}>conf: {e.conf}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Dynamically connected to dynamicRisks — scores pulse and shift live!
function RiskTableFinder({ dynamicRisks, trips }) {
  const [query, setQuery]   = useState("");
  const [activeId, setActiveId] = useState(null);
  const [err, setErr]       = useState(false);

  const doSearch = () => {
    const v = query.trim().toUpperCase();
    if (!dynamicRisks[v]) { setErr(true); setActiveId(null); return; }
    setErr(false);
    setActiveId(v);
  };

  const currentData = activeId ? dynamicRisks[activeId] : null;
  const currentTrip = activeId ? trips.find(t => t.id === activeId) : null;
  
  let rows = [];
  let overall = 0;
  if (currentData) {
    rows = RISK_LABELS.map(r => {
      const s = currentData[r.key];
      return { ...r, score: s, sev: s > 65 ? "HIGH" : s > 40 ? "MED" : "LOW", sevColor: s > 65 ? C.red : s > 40 ? C.accent : C.green };
    });
    overall = Math.round(Object.values(currentData).reduce((a, b) => a + b, 0) / Object.values(currentData).length);
  }
  const oc = overall > 65 ? C.red : overall > 40 ? C.accent : C.green;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <SHead title="Vehicle Risk Analyser" icon="🔍" />
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <input value={query} onChange={e => setQuery(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && doSearch()}
          placeholder="Vehicle ID — e.g. TRK-001"
          style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 13px", color: C.text, fontSize: 12, fontFamily: "DM Mono", outline: "none" }} />
        <button onClick={doSearch} style={{ background: C.teal, border: "none", borderRadius: 8, padding: "9px 20px", color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Analyse</button>
      </div>
      <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 10 }}>Fleet: {Object.keys(dynamicRisks).join(" · ")}</div>
      {err && <div style={{ color: C.red, fontSize: 11.5, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>⚠️ Vehicle not found in active fleet.</div>}
      
      {activeId && currentData && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.text, fontFamily: "DM Mono" }}>{activeId}</span>
              {currentTrip && <Tag color={currentTrip.status === "ON_ROUTE" ? C.green : currentTrip.status === "AT_RISK" ? C.accent : C.red} label={currentTrip.status.replace("_", " ")} />}
              {currentTrip && <span style={{ fontSize: 10, color: C.muted }}>{currentTrip.from} → {currentTrip.to}</span>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: 1 }}>OVERALL RISK</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: oc, fontFamily: "DM Mono", lineHeight: 1 }}>{overall}<span style={{ fontSize: 11 }}>/100</span></div>
            </div>
          </div>
          <div style={{ height: 5, background: C.dim, borderRadius: 3, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${overall}%`, background: `linear-gradient(90deg, ${C.teal}, ${oc})`, borderRadius: 3, transition: "width 0.6s" }} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: C.tealLight }}>
                  {["Risk Factor", "Score", "Severity", "Trend", "Recommendation"].map(h => (
                    <th key={h} style={{ padding: "7px 10px", color: C.tealDark, fontWeight: 700, textAlign: "left", fontSize: 10.5, letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.card : C.white }}>
                    <td style={{ padding: "8px 10px", color: C.text, whiteSpace: "nowrap" }}>{r.icon} {r.label}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "DM Mono", color: r.sevColor, fontWeight: 700 }}>{r.score}</span>
                        <div style={{ width: 50, height: 4, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${r.score}%`, background: r.sevColor, transition: "width 0.8s ease-in-out" }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "8px 10px" }}><Tag color={r.sevColor} label={r.sev} /></td>
                    <td style={{ padding: "8px 10px", color: r.score > 50 ? C.red : C.green, fontWeight: 800, fontSize: 13 }}>{r.score > 50 ? "▲" : "▼"}</td>
                    <td style={{ padding: "8px 10px", color: C.muted, fontSize: 10 }}>{r.rec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SustainabilityMonitor({ history, trips, kpis }) {
  const co2 = kpis.carbonT;
  const baseline = 3.85;
  const saved = Math.max(0, baseline - co2).toFixed(2);
  const greenPct = Math.round(trips.filter(t => t.status === "ON_ROUTE").length / trips.length * 100);
  const credits  = (parseFloat(saved) * 840).toFixed(0);
  const data = history.slice(-14).map((h, i) => ({ i, co2: h.co2.toFixed(2), base: 3.85 }));

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <SHead title="Sustainability Monitor" icon="🌿" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          ["CO₂ Emitted",     co2 + " T",   C.orange],
          ["CO₂ Saved",       saved + " T",  C.green ],
          ["Green Routes",    greenPct + "%",C.teal  ],
          ["Carbon Credits",  "₹" + credits, C.purple],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: C.tealLight, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: "DM Mono", marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, fontWeight: 600 }}>EMISSIONS VS BASELINE (T CO₂)</div>
      {trips.slice(0, 5).map(t => {
        const actual = t.status === "ON_ROUTE" ? 0.18 : t.status === "AT_RISK" ? 0.32 : 0.51;
        const base   = 0.42;
        return (
          <div key={t.id} style={{ marginBottom: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: C.text, fontFamily: "DM Mono", fontWeight: 600 }}>{t.id}</span>
              <span style={{ color: actual < base ? C.green : C.red }}>{actual}T <span style={{ color: C.muted }}>/ {base}T base</span></span>
            </div>
            <div style={{ height: 4, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(actual / base) * 100}%`, background: actual < base ? C.green : C.red, transition: "width 1s" }} />
            </div>
          </div>
        );
      })}
      <div style={{ height: 70, marginTop: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis dataKey="i" hide />
            <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, fontSize: 10, borderRadius: 8 }} />
            <Area type="monotone" dataKey="base" stroke={C.orange + "80"} fill={C.orange + "15"} strokeWidth={1.5} strokeDasharray="4,4" dot={false} name="Baseline T" />
            <Area type="monotone" dataKey="co2"  stroke={C.teal}            fill={C.teal + "20"}  strokeWidth={2}  dot={false}            name="Actual T" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Dynamically calculates scenarios based on the shifting ACTUAL gap vs OPTIMAL gap
function CounterfactualProfit({ history }) {
  const recent  = history.slice(-18);
  const actual  = recent.reduce((a, h) => a + h.revenue, 0);
  const optimal = recent.reduce((a, h) => a + h.optimal, 0);
  const gap     = optimal - actual;
  const gapPct  = ((gap / optimal) * 100).toFixed(1);
  
  const scenarios = [
    { label: "If all routes optimised",       gain: `₹${(gap * 0.55).toFixed(0)}k`, pct: `+${(gapPct * 0.55).toFixed(1)}%`, c: C.green  },
    { label: "If all delays eliminated",      gain: `₹${(gap * 0.28).toFixed(0)}k`, pct: `+${(gapPct * 0.28).toFixed(1)}%`, c: C.blue   },
    { label: "If fleet utilisation +5%",      gain: `₹${(gap * 0.12).toFixed(0)}k`, pct: `+${(gapPct * 0.12).toFixed(1)}%`, c: C.purple },
    { label: "If green routes adopted 100%",  gain: `₹${(gap * 0.05).toFixed(0)}k`, pct: `+${(gapPct * 0.05).toFixed(1)}%`, c: C.teal   },
  ];
  
  const chartData = recent.map((h, i) => ({ i, actual: h.revenue, optimal: h.optimal }));

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <SHead title="Counterfactual Profit Monitor" icon="💹" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div style={{ background: C.tealLight, borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: 1 }}>ACTUAL REVENUE</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "DM Mono", marginTop: 3 }}>₹{actual.toFixed(0)}k</div>
          <div style={{ fontSize: 9.5, color: C.muted }}>last {recent.length} periods</div>
        </div>
        <div style={{ background: "#f0fdf4", border: `1px solid ${C.green}44`, borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: 1 }}>OPTIMAL POTENTIAL</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.green, fontFamily: "DM Mono", marginTop: 3 }}>₹{optimal.toFixed(0)}k</div>
          <div style={{ fontSize: 9.5, color: C.green }}>AI-optimised scenario</div>
        </div>
      </div>
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 9.5, color: C.red, fontWeight: 700, letterSpacing: 1 }}>OPPORTUNITY COST</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.red, fontFamily: "DM Mono" }}>−₹{gap.toFixed(0)}k</div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.red, fontFamily: "DM Mono" }}>{gapPct}%</div>
      </div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 7 }}>COUNTERFACTUAL SCENARIOS</div>
      {scenarios.map(s => (
        <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 10.5, color: C.text }}>{s.label}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: "DM Mono", color: s.c, fontWeight: 700 }}>{s.gain}</span>
            <Tag color={s.c} label={s.pct} />
          </div>
        </div>
      ))}
      <div style={{ height: 70, marginTop: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <XAxis dataKey="i" hide />
            <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, fontSize: 10, borderRadius: 8 }} formatter={v => `₹${v}k`} />
            <Area type="monotone" dataKey="optimal" stroke={C.green} fill={C.green + "18"} strokeWidth={1.8} dot={false} name="Optimal ₹k" />
            <Area type="monotone" dataKey="actual"  stroke={C.teal}  fill={C.teal + "22"}  strokeWidth={1.8} dot={false} name="Actual ₹k" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Connected to live dynamic envData state
function IoTPanel({ trips, envData }) {
  const t = trips[0];
  const currentLat = CITIES_LATLNG[t.from]?.lat || 0;
  const currentLng = CITIES_LATLNG[t.from]?.lng || 0;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <SHead title="IoT Data Sources" icon="📡" />
      {[
        { icon: "📍", label: "GPS Sensors",      val: `${currentLat.toFixed(2)}°N, ${currentLng.toFixed(2)}°E`,  sub: `${t?.speed} km/h`         },
        { icon: "🚛", label: "Vehicles & Fleet",  val: t?.id || "—",                sub: t?.driver || "—"           },
        { icon: "🏭", label: "Warehouse Sensors", val: `${envData.temp.toFixed(1)}°C · ${envData.humidity}% RH`,  sub: `WH-Mumbai: ${envData.capacity}% capacity`  },
        { icon: "🚦", label: "Traffic API",       val: `${t ? Math.floor(t.speed < 55 ? 65 : 35) : 40}% congestion`, sub: `NH-48 · NH-44 live` },
        { icon: "🌤️", label: "Weather API",      val: envData.temp > 28 ? "Clear/Sunny" : "Partly Cloudy", sub: `${envData.temp.toFixed(1)}°C · IMD feed live`     },
        { icon: "📋", label: "Order Management",  val: `${trips.filter(r => r.status === "DELAYED").reduce((a, r) => a + 1, 0) * 18 + 284} pending`, sub: "live from OMS" },
      ].map((item, i, arr) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>{item.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, color: C.muted }}>{item.label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, fontFamily: "DM Mono" }}>{item.val}</div>
            <div style={{ fontSize: 9.5, color: C.muted }}>{item.sub}</div>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {[0,1,2].map(j => (
              <div key={j} style={{ width: 4, height: 4, borderRadius: "50%", background: C.teal,
                animation: `blink 1.4s ease ${j * 0.35}s infinite`, opacity: 0.6 }} />
            ))}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 10, background: C.tealLight, borderRadius: 8, padding: "7px 11px", fontSize: 10, color: C.tealDark, fontFamily: "DM Mono", fontWeight: 600 }}>
        Stream: {envData.bandwidth} MB/s · Cloud: 162 GB
      </div>
    </div>
  );
}

function ApplicationLayer({ orders, alerts, trips, history }) {
  const pieData = [
    { name: "Delivered", value: orders.delivered },
    { name: "In Transit", value: orders.inTransit },
    { name: "Pending", value: orders.pending },
  ];
  const barData = history.slice(-10).map(h => ({ t: h.time, v: h.deliveries }));

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <SHead title="Application Layer" icon="📱" />
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr", gap: 12 }}>
        <div style={{ background: C.tealLight, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tealDark, marginBottom: 8 }}>📊 Smart Dashboard</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 8 }}>
            {[["Delivered", orders.delivered, C.green], ["Transit", orders.inTransit, C.blue], ["Pending", orders.pending, C.accent]].map(([l,v,c]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: "DM Mono" }}>{v}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 55 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barSize={6}>
                <Bar dataKey="v" fill={C.teal} radius={[2,2,0,0]} />
                <Tooltip contentStyle={{ background: C.surface, fontSize: 10, borderRadius: 6 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ background: C.tealLight, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tealDark, marginBottom: 8 }}>🔔 Alerts & Notifications</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 110, overflowY: "auto" }}>
            {alerts.length === 0
              ? <div style={{ fontSize: 10, color: C.green }}>✓ All systems nominal</div>
              : alerts.slice(0, 5).map(a => (
                <div key={a.id} style={{ fontSize: 9.5, color: C.red, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 5, padding: "3px 8px", lineHeight: 1.4 }}>{a.msg}</div>
              ))
            }
          </div>
        </div>
        <div style={{ background: C.tealLight, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tealDark, marginBottom: 8 }}>💡 Decision Support</div>
          {[
            { a: "Reroute VAN-017 — NH-2 accident", p:"HIGH", c:C.red },
            { a: "Pre-stage WH-Blr for TRK-042",   p:"MED",  c:C.accent },
            { a: "Consolidate TRK-055 at Nagpur",   p:"LOW",  c:C.green  },
          ].map((r,i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 9.5, color: C.text, lineHeight: 1.3 }}>{r.a}</span>
              <Tag color={r.c} label={r.p} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Connected to live dynamic bizMetrics and envData state
function StakeholderPanel({ trips, orders, bizMetrics, envData }) {
  const [active, setActive] = useState("manager");
  const TABS = [{ id:"manager",icon:"👔",label:"Manager"},{id:"driver",icon:"🚛",label:"Driver"},{id:"warehouse",icon:"🏭",label:"Warehouse"},{id:"customer",icon:"👥",label:"Customer"}];
  const pieData = [{name:"Done",value:orders.delivered},{name:"Transit",value:orders.inTransit},{name:"Pending",value:orders.pending}];
  const PC = [C.teal,C.blue,C.accent];
  const t = trips[1]; 

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <SHead title="Stakeholders" icon="👥" />
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setActive(tb.id)} style={{
            flex:1, padding:"6px 4px", borderRadius:8, border:`1px solid ${active===tb.id?C.teal:C.border}`,
            background:active===tb.id?C.teal:"transparent", color:active===tb.id?C.white:C.muted,
            fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.2s"
          }}>{tb.icon} {tb.label}</button>
        ))}
      </div>
      {active==="manager" && (
        <div>
          {[["On-time Rate", `${bizMetrics.onTimeRate.toFixed(1)}%`, C.green], ["Active Fleet", trips.length+" vehicles", C.teal], ["Cost / km", `₹${bizMetrics.costPerKm.toFixed(2)}`, C.accent]].map(([l,v,c])=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px", background:C.tealLight, borderRadius:9, marginBottom:7 }}>
              <span style={{ fontSize:11.5, color:C.muted }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:800, color:c, fontFamily:"DM Mono" }}>{v}</span>
            </div>
          ))}
          <div style={{ height:90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={24} outerRadius={40} dataKey="value" paddingAngle={2}>
                {pieData.map((_,i)=><Cell key={i} fill={PC[i]} />)}
              </Pie><Tooltip contentStyle={{ background:C.surface, fontSize:10, borderRadius:6 }} /></PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            {pieData.map((d,i)=><span key={i} style={{ fontSize:9.5, color:PC[i], fontWeight:600 }}>■ {d.name}</span>)}
          </div>
        </div>
      )}
      {active==="driver" && t && (
        <div>
          <div style={{ background:C.tealLight, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 13px", marginBottom:8 }}>
            <div style={{ fontSize:9.5, color:C.muted }}>Active Vehicle</div>
            <div style={{ fontSize:15, fontWeight:800, color:C.teal, fontFamily:"DM Mono" }}>{t.id}</div>
            <div style={{ fontSize:11, color:C.muted }}>{t.driver}</div>
          </div>
          {[["Speed",`${t.speed} km/h`,C.blue],["ETA",`${t.eta} min`,C.accent],["Fuel",`${t.fuel.toFixed(0)}%`,t.fuel<40?C.red:C.green]].map(([l,v,c])=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px", background:C.tealLight, borderRadius:9, marginBottom:7 }}>
              <span style={{ fontSize:11.5, color:C.muted }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:800, color:c, fontFamily:"DM Mono" }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {active==="warehouse" && (
        <div>
          {[["Temperature",`${envData.temp.toFixed(1)}°C`,C.blue],["Humidity",`${envData.humidity}%`,C.purple],["WH Capacity",`${envData.capacity}%`,C.accent]].map(([l,v,c])=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px", background:C.tealLight, borderRadius:9, marginBottom:7 }}>
              <span style={{ fontSize:11.5, color:C.muted }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:800, color:c, fontFamily:"DM Mono" }}>{v}</span>
            </div>
          ))}
          <div style={{ background:C.tealLight, borderRadius:9, padding:"10px 13px" }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:6, fontWeight:600 }}>INBOUND VEHICLES</div>
            {trips.filter(r=>["Mumbai","Bangalore","Delhi"].includes(r.to)).slice(0,3).map(r=>(
              <div key={r.id} style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, padding:"4px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ color:C.text, fontFamily:"DM Mono", fontWeight:600 }}>{r.id}</span>
                <span style={{ color:C.muted }}>{r.from} → {r.to}</span>
                <Tag color={r.status==="ON_ROUTE"?C.green:r.status==="AT_RISK"?C.accent:C.red} label={r.status==="ON_ROUTE"?"ON TIME":r.status} />
              </div>
            ))}
          </div>
        </div>
      )}
      {active==="customer" && (
        <div>
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:9, padding:"11px 13px", marginBottom:8 }}>
            <div style={{ fontSize:9.5, color:C.muted }}>ORDER #ORD-2847</div>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:4 }}>
              <LiveDot color={C.green} /><span style={{ fontSize:13, fontWeight:700, color:C.green }}>In Transit</span>
            </div>
            <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>ETA: {trips[0]?.eta || 88} min · TRK-088 via NH-44</div>
          </div>
          {[["Total Delivered",orders.delivered,C.teal],["Satisfaction",`${bizMetrics.satisfaction.toFixed(1)} / 5 ⭐`,C.accent]].map(([l,v,c])=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px", background:C.tealLight, borderRadius:9, marginBottom:7 }}>
              <span style={{ fontSize:11.5, color:C.muted }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:800, color:c, fontFamily:"DM Mono" }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FleetTable({ trips }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <SHead title="Live Fleet Status" icon="🚛" />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: C.teal }}>
              {["Vehicle", "Route", "Driver", "Cargo", "Speed", "Fuel", "ETA", "Status"].map(h => (
                <th key={h} style={{ padding: "8px 12px", color: C.white, fontWeight: 700, textAlign: "left", fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trips.map((t, i) => (
              <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.tealLight : C.white }}>
                <td style={{ padding: "8px 12px", fontFamily: "DM Mono", fontWeight: 700, color: C.text }}>{t.id}</td>
                <td style={{ padding: "8px 12px", color: C.muted }}>{t.from} → {t.to}</td>
                <td style={{ padding: "8px 12px", color: C.text }}>{t.driver}</td>
                <td style={{ padding: "8px 12px", color: C.muted }}>{t.cargo}</td>
                <td style={{ padding: "8px 12px", fontFamily: "DM Mono", color: C.blue }}>{t.speed} km/h</td>
                <td style={{ padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: "DM Mono", color: t.fuel < 40 ? C.red : C.green, fontWeight: 700 }}>{t.fuel.toFixed(0)}%</span>
                    <div style={{ width: 36, height: 4, background: C.dim, borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${t.fuel}%`, background: t.fuel < 40 ? C.red : C.teal, borderRadius: 2, transition: "width 0.8s" }} />
                    </div>
                  </div>
                </td>
                <td style={{ padding: "8px 12px", fontFamily: "DM Mono", color: t.delay > 0 ? C.red : C.text }}>{t.eta} min{t.delay > 0 ? ` (+${t.delay})` : ""}</td>
                <td style={{ padding: "8px 12px" }}><Tag color={t.status==="ON_ROUTE"?C.green:t.status==="AT_RISK"?C.accent:C.red} label={t.status.replace("_"," ")} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MODULES = ["Dashboard Overview","Live Fleet Map","Agentic AI Feed","Risk Analyser","Sustainability","Profit Monitor","Fleet Status"];

export default function LogisticsAI() {
  const { trips, kpis, orders, history, agentLog, alerts, tick, envData, bizMetrics, dynamicRisks } = useLiveData();
  const [module, setModule] = useState("Dashboard Overview");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.pageBg, fontFamily: "'Sora', sans-serif", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.dim};border-radius:2px}
        @keyframes blink{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes ping{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.2);opacity:0}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
        input:focus{border-color:${C.teal} !important;outline:none;box-shadow:0 0 0 3px ${C.teal}22}
        button:hover{opacity:0.88}
      `}</style>

      {/* ── Sidebar Navigation ── */}
      <div style={{ width: 230, background: C.navBg, borderRight: `1px solid ${C.navBorder}`, padding: "24px 16px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Navigation</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Choose a module</div>
        <select value={module} onChange={e => setModule(e.target.value)}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
          {MODULES.map(m => <option key={m} value={m}>📦 {m}</option>)}
        </select>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 4 }}>
          {MODULES.map(m => (
            <button key={m} onClick={() => setModule(m)} style={{
              background: module === m ? C.tealLight : "transparent",
              border: module === m ? `1px solid ${C.border}` : "1px solid transparent",
              borderRadius: 8, padding: "8px 12px", textAlign: "left", cursor: "pointer",
              fontSize: 11.5, fontWeight: module === m ? 700 : 500,
              color: module === m ? C.teal : C.muted, transition: "all 0.15s"
            }}>{m}</button>
          ))}
        </div>
        <div style={{ marginTop: "auto", background: C.tealLight, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.teal, fontWeight: 700 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.teal, animation: "blink 1.2s infinite" }} />
            LIVE · {tick} events
          </div>
          <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>{new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, padding: "24px 24px", overflowY: "auto" }}>
        <div style={{ background: C.surface, borderRadius: 16, padding: "24px 28px", marginBottom: 24, boxShadow: "0 2px 12px #1aab8a14" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text, marginBottom: 6 }}>🚛 Logistics AI Dashboard</div>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>Intelligent logistics optimisation powered by Machine Learning & Real-Time IoT</div>
        </div>

        <div style={{ marginBottom: 6, fontSize: 18, fontWeight: 700, color: C.text }}>{module}</div>
        <KpiStrip kpis={kpis} />

        {/* Dynamic Route Pages */}
        {(module === "Dashboard Overview") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <LeafletMap trips={trips} />
              <ApplicationLayer orders={orders} alerts={alerts} trips={trips} history={history} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <StakeholderPanel trips={trips} orders={orders} bizMetrics={bizMetrics} envData={envData} />
              <IoTPanel trips={trips} envData={envData} />
            </div>
          </div>
        )}

        {module === "Live Fleet Map" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <LeafletMap trips={trips} />
            <FleetTable trips={trips} />
          </div>
        )}

        {module === "Agentic AI Feed" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
            <AgenticFeed log={agentLog} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ApplicationLayer orders={orders} alerts={alerts} trips={trips} history={history} />
            </div>
          </div>
        )}

        {module === "Risk Analyser" && <RiskTableFinder dynamicRisks={dynamicRisks} trips={trips} />}

        {module === "Sustainability" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <SustainabilityMonitor history={history} trips={trips} kpis={kpis} />
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
              <SHead title="Sustainability Trends" icon="📈" />
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.slice(-16)}>
                    <XAxis dataKey="time" fontSize={9} tick={{ fill: C.muted }} />
                    <YAxis fontSize={9} tick={{ fill: C.muted }} />
                    <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, fontSize: 10, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="co2"  stroke={C.teal}   strokeWidth={2} dot={false} name="CO₂ T" />
                    <Line type="monotone" dataKey="fuel" stroke={C.orange} strokeWidth={2} dot={false} name="Fuel %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {module === "Profit Monitor" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <CounterfactualProfit history={history} />
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
              <SHead title="Revenue vs Optimal" icon="📊" />
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.slice(-16)}>
                    <XAxis dataKey="time" fontSize={9} tick={{ fill: C.muted }} />
                    <YAxis fontSize={9} tick={{ fill: C.muted }} />
                    <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, fontSize: 10, borderRadius: 8 }} formatter={v => `₹${v}k`} />
                    <Area type="monotone" dataKey="optimal" stroke={C.green} fill={C.green + "15"} strokeWidth={2} dot={false} name="Optimal ₹k" />
                    <Area type="monotone" dataKey="revenue" stroke={C.teal}  fill={C.teal + "20"}  strokeWidth={2} dot={false} name="Actual ₹k" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {module === "Fleet Status" && <FleetTable trips={trips} />}
      </div>
    </div>
  );
}