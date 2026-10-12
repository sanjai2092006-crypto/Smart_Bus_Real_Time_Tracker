const socket = io();

const busSelect = document.getElementById("busSelect");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("driverStatus");

let watchId = null;

function sendLocation(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const speedMs = position.coords.speed;
  const speedKmh = speedMs == null ? 0 : Math.max(0, speedMs * 3.6);

  document.getElementById("lat").textContent = lat.toFixed(6);
  document.getElementById("lng").textContent = lng.toFixed(6);
  document.getElementById("driverSpeed").textContent =
    `${speedKmh.toFixed(0)} km/h`;

  socket.emit("driver:updateLocation", {
    busId: busSelect.value,
    lat,
    lng,
    speed: speedKmh
  });

  statusEl.textContent = `🟢 Sending live location at ${new Date().toLocaleTimeString()}`;
}

function gpsError(error) {
  statusEl.textContent = `⚠️ GPS error: ${error.message}`;
}

startBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    statusEl.textContent = "This device/browser does not support GPS.";
    return;
  }

  if (watchId !== null) navigator.geolocation.clearWatch(watchId);

  watchId = navigator.geolocation.watchPosition(
    sendLocation,
    gpsError,
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );

  statusEl.textContent = "📡 Waiting for GPS location...";
});

stopBtn.addEventListener("click", () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  socket.emit("driver:stop", { busId: busSelect.value });
  statusEl.textContent = "🔴 Tracking stopped.";
});
