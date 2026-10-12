const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

/*
  Demo route:
  Thoothukudi -> Tirunelveli
  Coordinates are example/demo coordinates. Replace them with your
  actual route/stop coordinates for deployment.
*/
const routes = {
  "tuticorin-tirunelveli": {
    id: "tuticorin-tirunelveli",
    from: "Thoothukudi",
    to: "Tirunelveli",
    stops: [
      { id: "t1", name: "Thoothukudi New Bus Stand", lat: 8.8057, lng: 78.1450 },
      { id: "t2", name: "Puthukottai", lat: 8.7418, lng: 78.0238 },
      { id: "t3", name: "Srivaikuntam", lat: 8.6300, lng: 77.9130 },
      { id: "t4", name: "Tirunelveli Junction", lat: 8.7270, lng: 77.7080 },
      { id: "t5", name: "Tirunelveli New Bus Stand", lat: 8.7290, lng: 77.7550 }
    ]
  }
};

const buses = {
  "TN-72-AB-1234": {
    id: "TN-72-AB-1234",
    name: "Bus 101",
    routeId: "tuticorin-tirunelveli",
    lat: 8.7950,
    lng: 78.1200,
    speed: 34,
    status: "live",
    updatedAt: Date.now(),
    driver: "Demo Driver"
  },
  "TN-72-CD-5678": {
    id: "TN-72-CD-5678",
    name: "Bus 102",
    routeId: "tuticorin-tirunelveli",
    lat: 8.7700,
    lng: 78.0800,
    speed: 42,
    status: "live",
    updatedAt: Date.now(),
    driver: "Demo Driver"
  },
  "TN-72-EF-9012": {
    id: "TN-72-EF-9012",
    name: "Bus 103",
    routeId: "tuticorin-tirunelveli",
    lat: 8.7350,
    lng: 77.9700,
    speed: 31,
    status: "live",
    updatedAt: Date.now(),
    driver: "Demo Driver"
  }
};

function publicBus(bus) {
  const copy = { ...bus };
  copy.status = Date.now() - copy.updatedAt <= 15000 ? "live" : "offline";
  return copy;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getNextStop(bus) {
  const route = routes[bus.routeId];
  let nearestIndex = 0;
  let nearestDistance = Infinity;

  route.stops.forEach((stop, index) => {
    const d = distanceKm(bus.lat, bus.lng, stop.lat, stop.lng);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearestIndex = index;
    }
  });

  const next = route.stops[Math.min(nearestIndex + 1, route.stops.length - 1)];
  return next;
}

function estimateEtaMinutes(bus, destinationStop) {
  if (!destinationStop || !bus.speed || bus.speed < 5) return null;
  const km = distanceKm(bus.lat, bus.lng, destinationStop.lat, destinationStop.lng);
  return Math.max(1, Math.round((km / bus.speed) * 60));
}

app.get("/api/routes", (req, res) => {
  res.json(Object.values(routes));
});

app.get("/api/buses", (req, res) => {
  const routeId = req.query.routeId;
  const list = Object.values(buses)
    .filter(b => !routeId || b.routeId === routeId)
    .map(publicBus);
  res.json(list);
});

app.get("/api/buses/:id", (req, res) => {
  const bus = buses[req.params.id];
  if (!bus) return res.status(404).json({ error: "Bus not found" });

  const route = routes[bus.routeId];
  const nextStop = getNextStop(bus);
  const eta = estimateEtaMinutes(bus, route.stops[route.stops.length - 1]);

  res.json({
    ...publicBus(bus),
    route,
    nextStop,
    eta
  });
});

io.on("connection", socket => {
  socket.emit("allBusLocations", Object.values(buses).map(publicBus));

  socket.on("driver:updateLocation", payload => {
    const { busId, lat, lng, speed } = payload || {};
    const bus = buses[busId];

    if (!bus || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return;
    }

    bus.lat = Number(lat);
    bus.lng = Number(lng);
    bus.speed = Number.isFinite(Number(speed)) ? Math.max(0, Number(speed)) : bus.speed;
    bus.updatedAt = Date.now();
    bus.status = "live";

    io.emit("bus:update", publicBus(bus));
  });

  socket.on("driver:stop", ({ busId }) => {
    if (!buses[busId]) return;
    buses[busId].status = "offline";
    buses[busId].updatedAt = Date.now() - 60000;
    io.emit("bus:update", publicBus(buses[busId]));
  });
});

setInterval(() => {
  Object.values(buses).forEach(bus => {
    if (Date.now() - bus.updatedAt > 15000) {
      bus.status = "offline";
    }
  });
}, 5000);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
  console.log(`SmartBus running at http://localhost:${PORT}`);
});
