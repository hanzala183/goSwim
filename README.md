# goSwim - Swimming Pool Live Water Quality Platform

goSwim is a platform that helps users find swimming pools near them and view real-time water quality data and other important details of its network.

## Features

- Find swimming pools near your location
- Search pools by name or location
- View real-time water quality data
- Interactive Maps integration
- Detailed pool information including facilities and opening hours
- Live weather information for pool locations
- Real-time water quality monitoring with professional devices
- Verified and tamper-proof water quality data

## Water Quality Monitoring

The platform is designed to integrate with professional water quality monitoring devices. Currently, the following devices are supported:

1. **pHin Smart Water Monitor (by Hayward)**
2. **WaterGuru Sense**
3. **Ondilo ICO**
## Data Verification and Security

To ensure data integrity and prevent manipulation, the platform implements several security measures:

1. **Direct Device Integration**
   - Data is sourced directly from manufacturer APIs
   - No manual data entry allowed
   - Real-time data streaming from devices

2. **Device Authentication**
   - Secure API keys for device authentication

3. **Data Verification**
   - Manufacturer-verified data signatures
   - Timestamp validation
   - Data consistency checks
   - Anomaly detection

4. **Security Measures**
   - End-to-end encryption for data transmission
   - Secure API endpoints with rate limiting
   - Regular security audits
   - Data backup and redundancy

> **Note:** For demonstration purposes, the current implementation uses mock data from a mock server. In a production environment, this would be replaced with real-time data from the above-mentioned water quality monitoring devices, with all security measures in place.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/goswim.git
cd goswim
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Create a PostgreSQL database named 'goswim'
createdb goswim

# Import the database schema and sample data
psql goswim < database.sql
```

4. Create a `.env` file in the root directory with the following variables:
```
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=goswim
PORT=3000
```

5. Replace the Google Maps API key in `public/index.html`:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&callback=initMap" async defer></script>
```

## Running the Application

1. Start the main server:
```bash
node server.js
```

2. In a separate terminal, start the mock server for pool data:
```bash
node mock-server.js
```

3. Open your browser and navigate to `http://localhost:3000`

## Project Structure

- `public/` - Frontend files (HTML, CSS, JS)
- `server.js` - Main Express server
- `mock-server.js` - Mock server for pool data
- `database.sql` - Database schema and sample data

## API Endpoints

### Main Server (port 3000)
- `GET /api/pools/nearby` - Get nearby pools
- `GET /api/pools/search` - Search pools by name or location
- `GET /api/pools/:id` - Get pool details

### Mock Server (port 3001)
- `GET /api/pool-data/:id` - Get mock live data for a pool
  > **Note:** This endpoint simulates real-time data from water quality monitoring devices. In production, this would be replaced with actual device data.

## Future Enhancements Goals

- Integration with real water quality monitoring devices
- Real-time alerts for water quality issues
- Historical data analysis and trends
- Automated maintenance scheduling
- Mobile app development
- User authentication and personalized dashboards
- Enhanced data verification and security measures
- Integration with additional water quality monitoring devices
- Real-time compliance reporting
- Automated regulatory compliance checks