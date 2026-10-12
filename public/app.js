const socket = io();

const searchPage = document.getElementById("searchPage");
const resultsPage = document.getElementById("resultsPage");
const trackingPage = document.getElementById("trackingPage");

const fromSelect = document.getElementById("fromSelect");
const toSelect = document.getElementById("toSelect");
const searchBtn = document.getElementById("searchBtn");
const backBtn = document.getElementById("backBtn");
const trackBackBtn = document.getElementById("trackBackBtn");

const busList = document.getElementById("busList");
const noBuses = document.getElementById("noBuses");
const locationStatus = document.getElementById("locationStatus");
const routeTitle = document.getElementById("routeTitle");

let routes = [];
let buses = [];
let userLocation = null;
let selectedRoute = null;
let selectedBus = null;
let map = null;
let busMarker = null;
let routeLine = null;
let stopMarkers = [];

async function loadRoutes() {
  const res = await fetch("/api/routes");
  routes = await res.json();

  const froms = [...new Set(routes.map(r => r.from))];
  fromSelect.innerHTML = froms.map(x => `<option value="${x}">${x}</option>`).join("");

  updateToOptions();
}

function updateToOptions() {
  const route = routes.find(r => r.from === fromSelect.value);
  toSelect.innerHTML = route
    ? `<option value="${route.to}">${route.to}</option>`
    : "";
}

fromSelect.addEventListener("change", updateToOptions);

function haversine(lat1, lng1, lat2, lng2) {
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

function getDistanceToUser(bus) {
  if (!userLocation) return 999999;
  return haversine(
    userLocation.lat,
    userLocation.lng,
    bus.lat,
    bus.lng
  );
}

function getNextStop(bus, route) {
  let nearestIndex = 0;
  let nearestDistance = Infinity;

  route.stops.forEach((stop, index) => {
    const d = haversine(bus.lat, bus.lng, stop.lat, stop.lng);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearestIndex = index;
    }
  });

  return route.stops[Math.min(nearestIndex + 1, route.stops.length - 1)];
}

function renderBusList() {
  busList.innerHTML = "";
  noBuses.classList.add("hidden");

  if (!buses.length) {
    noBuses.classList.remove("hidden");
    return;
  }

  buses
    .sort((a, b) => getDistanceToUser(a) - getDistanceToUser(b))
    .forEach(bus => {
      const distance = getDistanceToUser(bus);
      const route = selectedRoute;
      const nextStop = getNextStop(bus, route);

      const card = document.createElement("div");
      card.className = "bus-card";
      card.innerHTML = `
        <div class="bus-card-top">
          <div>
            <h3>🚌 ${bus.name}</h3>
            <p>${bus.id}</p>
          </div>
          <span class="status ${bus.status}">
            ${bus.status === "live" ? "● LIVE" : "● OFFLINE"}
          </span>
        </div>

        <div class="route-name">
          ${route.from} → ${route.to}
        </div>

        <div class="bus-info">
          <span>📍 ${distance === 999999 ? "Location unavailable" : distance.toFixed(1) + " km away"}</span>
          <span>🚀 ${Math.round(bus.speed || 0)} km/h</span>
          <span>📌 ${nextStop.name}</span>
        </div>

        <button class="track-btn">TRACK LIVE BUS →</button>
      `;

      card.querySelector(".track-btn").addEventListener("click", () => openTracking(bus));
      busList.appendChild(card);
    });
}

async function searchBuses() {
  const from = fromSelect.value;
  const to = toSelect.value;

  selectedRoute = routes.find(r => r.from === from && r.to === to);

  if (!selectedRoute) return;

  routeTitle.textContent = `${from} → ${to}`;
  locationStatus.textContent = "Finding buses near your location...";

  searchPage.classList.add("hidden");
  resultsPage.classList.remove("hidden");

  try {
    const res = await fetch(`/api/buses?routeId=${encodeURIComponent(selectedRoute.id)}`);
    buses = await res.json();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          locationStatus.textContent =
            `📍 Nearby buses sorted by your current location`;
          renderBusList();
        },
        () => {
          locationStatus.textContent =
            "📍 Location permission unavailable — showing route buses.";
          renderBusList();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000
        }
      );
    } else {
      locationStatus.textContent = "Location is not supported by this browser.";
      renderBusList();
    }
  } catch (e) {
    locationStatus.textContent = "Unable to load buses.";
  }
}

function initMap(route) {
  if (map) {
    map.remove();
  }

  map = L.map("map").setView([route.stops[0].lat, route.stops[0].lng], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const points = route.stops.map(s => [s.lat, s.lng]);
  routeLine = L.polyline(points, { weight: 5 }).addTo(map);

  stopMarkers = route.stops.map((stop, index) => {
    const marker = L.marker([stop.lat, stop.lng])
      .addTo(map)
      .bindPopup(`<strong>${index + 1}. ${stop.name}</strong>`);
    return marker;
  });

  map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });

  busMarker = L.marker([selectedBus.lat, selectedBus.lng], {
    title: selectedBus.name
  }).addTo(map);

  busMarker.bindPopup(`<strong>${selectedBus.name}</strong><br>Live bus`);
}

function updateTrackingUI(bus) {
  selectedBus = { ...selectedBus, ...bus };

  const route = selectedRoute;
  const nextStop = getNextStop(selectedBus, route);

  const destination = route.stops[route.stops.length - 1];
  const distanceToDestination = haversine(
    selectedBus.lat,
    selectedBus.lng,
    destination.lat,
    destination.lng
  );

  const speed = Math.max(1, Number(selectedBus.speed || 0));
  const eta = speed >= 5
    ? Math.max(1, Math.round((distanceToDestination / speed) * 60))
    : null;

  document.getElementById("eta").textContent = eta ? `${eta} min` : "--";
  document.getElementById("speed").textContent = `${Math.round(selectedBus.speed || 0)} km/h`;
  document.getElementById("nextStop").textContent = nextStop.name;
  document.getElementById("liveStatus").textContent =
    selectedBus.status === "live" ? "LIVE" : "OFFLINE";

  document.getElementById("updatedText").textContent =
    `Updated ${new Date(selectedBus.updatedAt).toLocaleTimeString()}`;

  if (busMarker) {
    busMarker.setLatLng([selectedBus.lat, selectedBus.lng]);
    busMarker.setPopupContent(
      `<strong>${selectedBus.name}</strong><br>${selectedBus.status.toUpperCase()}`
    );
  }
}

function openTracking(bus) {
  selectedBus = bus;

  resultsPage.classList.add("hidden");
  trackingPage.classList.remove("hidden");

  document.getElementById("trackBusName").textContent = `🚌 ${bus.name}`;
  document.getElementById("trackRoute").textContent =
    `${selectedRoute.from} → ${selectedRoute.to}`;
  document.getElementById("routeText").textContent =
    `${selectedRoute.from} → ${selectedRoute.to}`;

  setTimeout(() => {
    initMap(selectedRoute);
    updateTrackingUI(bus);
  }, 50);
}

searchBtn.addEventListener("click", searchBuses);

backBtn.addEventListener("click", () => {
  resultsPage.classList.add("hidden");
  searchPage.classList.remove("hidden");
});

trackBackBtn.addEventListener("click", () => {
  trackingPage.classList.add("hidden");
  resultsPage.classList.remove("hidden");
});

socket.on("allBusLocations", list => {
  buses = list;
  if (!resultsPage.classList.contains("hidden") && selectedRoute) {
    renderBusList();
  }
});

socket.on("bus:update", bus => {
  const index = buses.findIndex(b => b.id === bus.id);
  if (index >= 0) buses[index] = bus;

  if (selectedBus && selectedBus.id === bus.id) {
    updateTrackingUI(bus);
  }

  if (!resultsPage.classList.contains("hidden")) {
    renderBusList();
  }
});

loadRoutes();
