# SmartBus - Real-Time Public Bus Tracking

A hackathon-ready prototype based on this flow:

1. Passenger selects From and To.
2. System finds buses on that route.
3. Browser requests user's location.
4. Matching buses are sorted by distance from the user.
5. Passenger clicks a bus.
6. Live map opens.
7. Bottom section shows ETA, speed, next stop and route.
8. Driver page sends GPS through Socket.IO in real time.

## Run locally

Install Node.js 18+.

```bash
npm install
npm start
```

Open:

- Passenger: http://localhost:3000
- Driver: http://localhost:3000/driver.html

For phone GPS, use HTTPS in production. Modern browsers generally require a secure context for geolocation.

## Demo route

Thoothukudi -> Tirunelveli

The coordinates and stops in `server.js` are demo values. Replace them with your actual route coordinates.

## Architecture

Driver phone GPS
-> Socket.IO
-> Node.js server
-> passenger browser
-> Leaflet live map

## Next production upgrades

- MongoDB/PostgreSQL for users, buses, routes and location history
- Driver authentication
- Admin dashboard
- Real road-routing API for accurate ETA
- Traffic-aware ETA
- Proper Android driver app for reliable background tracking
- Push notifications
- Multiple routes and stops
- GPS device/ESP32 integration
- Rate limiting and authentication
