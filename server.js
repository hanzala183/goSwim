require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// Database connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database');
    release();
});

// Function to fetch pools from OpenStreetMap
async function fetchPoolsFromOSM(lat, lng, radius = 5000) {
    try {
        const query = `
            [out:json][timeout:25];
            (
              node["leisure"="swimming_pool"](around:${radius},${lat},${lng});
              way["leisure"="swimming_pool"](around:${radius},${lat},${lng});
              relation["leisure"="swimming_pool"](around:${radius},${lat},${lng});
            );
            out body;
            >;
            out skel qt;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.elements || [];
    } catch (error) {
        console.error('Error fetching pools from OpenStreetMap:', error);
        throw error;
    }
}

// Function to match OSM pools with database records
async function matchPoolsWithDatabase(osmPools) {
    try {
        const matchedPools = [];
        
        for (const osmPool of osmPools) {
            if (!osmPool.tags || !osmPool.tags.name) continue;

            // Search for matching pool in database
            const query = `
                SELECT *,
                (6371 * acos(
                    cos(radians($1)) * 
                    cos(radians(latitude)) * 
                    cos(radians(longitude) - radians($2)) + 
                    sin(radians($1)) * 
                    sin(radians(latitude))
                )) AS distance
                FROM swimming_pools 
                WHERE pool_name ILIKE $3
                OR (latitude BETWEEN $4 AND $5 AND longitude BETWEEN $6 AND $7)
                LIMIT 1;
            `;

            const result = await pool.query(query, [
                osmPool.lat,
                osmPool.lon,
                `%${osmPool.tags.name}%`,
                osmPool.lat - 0.001,
                osmPool.lat + 0.001,
                osmPool.lon - 0.001,
                osmPool.lon + 0.001
            ]);

            if (result.rows.length > 0) {
                // Found a match in our database
                const dbPool = result.rows[0];
                // Ensure has_live_data is properly set based on api_endpoint
                dbPool.has_live_data = Boolean(dbPool.api_endpoint);
                matchedPools.push({
                    ...dbPool,
                    osm_data: {
                        id: osmPool.id,
                        name: osmPool.tags.name,
                        type: osmPool.type,
                        tags: osmPool.tags
                    }
                });
            } else {
                // No match in database, use OSM data with no live data
                matchedPools.push({
                    pool_name: osmPool.tags.name,
                    address: osmPool.tags['addr:street'] || 'Address not available',
                    city: osmPool.tags['addr:city'] || 'City not available',
                    postal_code: osmPool.tags['addr:postcode'] || 'Postal code not available',
                    latitude: osmPool.lat,
                    longitude: osmPool.lon,
                    api_endpoint: null,
                    has_live_data: false,
                    contact_number: osmPool.tags.phone || 'Not available',
                    email: osmPool.tags.email || 'Not available',
                    opening_hours: JSON.stringify({
                        monday: osmPool.tags.opening_hours || '9:00 AM - 6:00 PM',
                        tuesday: osmPool.tags.opening_hours || '9:00 AM - 6:00 PM',
                        wednesday: osmPool.tags.opening_hours || '9:00 AM - 6:00 PM',
                        thursday: osmPool.tags.opening_hours || '9:00 AM - 6:00 PM',
                        friday: osmPool.tags.opening_hours || '9:00 AM - 6:00 PM',
                        saturday: osmPool.tags.opening_hours || '9:00 AM - 6:00 PM',
                        sunday: osmPool.tags.opening_hours || '9:00 AM - 6:00 PM'
                    }),
                    lifeguard_available: false,
                    emergency_equipment_available: false,
                    cctv_installed: false,
                    changing_rooms_available: true,
                    locker_facility: true,
                    osm_data: {
                        id: osmPool.id,
                        name: osmPool.tags.name,
                        type: osmPool.type,
                        tags: osmPool.tags
                    }
                });
            }
        }

        return matchedPools;
    } catch (error) {
        console.error('Error matching pools with database:', error);
        throw error;
    }
}

// API Endpoints
app.get('/api/pools/nearby', async (req, res) => {
    try {
        const { lat, lng, radius = 10 } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        // Fetch pools from OpenStreetMap
        const osmPools = await fetchPoolsFromOSM(lat, lng, radius);
        
        // Match with database records
        const matchedPools = await matchPoolsWithDatabase(osmPools);

        // Sort by distance from user's location
        matchedPools.sort((a, b) => {
            const distA = a.distance || calculateDistance(lat, lng, a.latitude, a.longitude);
            const distB = b.distance || calculateDistance(lat, lng, b.latitude, b.longitude);
            return distA - distB;
        });

        res.json(matchedPools);
    } catch (error) {
        console.error('Error fetching nearby pools:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/pools/search', async (req, res) => {
    try {
        const { query } = req.query;
        const searchQuery = `
            SELECT * FROM swimming_pools 
            WHERE pool_name ILIKE $1 
            OR city ILIKE $1 
            OR address ILIKE $1;
        `;
        const result = await pool.query(searchQuery, [`%${query}%`]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching pools:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/pools/all', async (req, res) => {
    try {
        const query = `
            SELECT *,
            CASE WHEN api_endpoint IS NOT NULL AND api_endpoint != '' THEN true ELSE false END as has_live_data
            FROM swimming_pools 
            ORDER BY pool_name;
        `;
        const result = await pool.query(query);
        
        // Add mock pools without live data
        const mockPools = [
            {
                pool_name: "Aqua Swimming Pool",
                address: "123 Main Road, Attapur",
                city: "Hyderabad",
                postal_code: "500018",
                latitude: 17.3850,
                longitude: 78.4867,
                api_endpoint: null,
                has_live_data: false,
                contact_number: "Not available",
                email: "Not available",
                opening_hours: JSON.stringify({
                    monday: "9:00 AM - 6:00 PM",
                    tuesday: "9:00 AM - 6:00 PM",
                    wednesday: "9:00 AM - 6:00 PM",
                    thursday: "9:00 AM - 6:00 PM",
                    friday: "9:00 AM - 6:00 PM",
                    saturday: "9:00 AM - 6:00 PM",
                    sunday: "9:00 AM - 6:00 PM"
                }),
                lifeguard_available: false,
                emergency_equipment_available: false,
                cctv_installed: false,
                changing_rooms_available: true,
                locker_facility: true
            },
            {
                pool_name: "Blue Wave Swimming Club",
                address: "45 Lake View Road, Attapur",
                city: "Hyderabad",
                postal_code: "500018",
                latitude: 17.3855,
                longitude: 78.4870,
                api_endpoint: null,
                has_live_data: false,
                contact_number: "Not available",
                email: "Not available",
                opening_hours: JSON.stringify({
                    monday: "8:00 AM - 7:00 PM",
                    tuesday: "8:00 AM - 7:00 PM",
                    wednesday: "8:00 AM - 7:00 PM",
                    thursday: "8:00 AM - 7:00 PM",
                    friday: "8:00 AM - 7:00 PM",
                    saturday: "8:00 AM - 7:00 PM",
                    sunday: "8:00 AM - 7:00 PM"
                }),
                lifeguard_available: true,
                emergency_equipment_available: true,
                cctv_installed: true,
                changing_rooms_available: true,
                locker_facility: true
            },
            {
                pool_name: "Crystal Clear Pool",
                address: "78 Waterfront Drive, Attapur",
                city: "Hyderabad",
                postal_code: "500018",
                latitude: 17.3845,
                longitude: 78.4865,
                api_endpoint: null,
                has_live_data: false,
                contact_number: "Not available",
                email: "Not available",
                opening_hours: JSON.stringify({
                    monday: "7:00 AM - 8:00 PM",
                    tuesday: "7:00 AM - 8:00 PM",
                    wednesday: "7:00 AM - 8:00 PM",
                    thursday: "7:00 AM - 8:00 PM",
                    friday: "7:00 AM - 8:00 PM",
                    saturday: "7:00 AM - 8:00 PM",
                    sunday: "7:00 AM - 8:00 PM"
                }),
                lifeguard_available: true,
                emergency_equipment_available: true,
                cctv_installed: false,
                changing_rooms_available: true,
                locker_facility: true
            },
            {
                pool_name: "Swimmers Place",
                address: "321 Sports Complex Road, Attapur",
                city: "Hyderabad",
                postal_code: "500018",
                latitude: 17.3860,
                longitude: 78.4880,
                api_endpoint: null,
                has_live_data: false,
                contact_number: "Not available",
                email: "Not available",
                opening_hours: JSON.stringify({
                    monday: "7:00 AM - 9:00 PM",
                    tuesday: "7:00 AM - 9:00 PM",
                    wednesday: "7:00 AM - 9:00 PM",
                    thursday: "7:00 AM - 9:00 PM",
                    friday: "7:00 AM - 9:00 PM",
                    saturday: "8:00 AM - 8:00 PM",
                    sunday: "8:00 AM - 8:00 PM"
                }),
                lifeguard_available: true,
                emergency_equipment_available: true,
                cctv_installed: true,
                changing_rooms_available: true,
                locker_facility: true
            }
        ];

        // Combine database pools with mock pools
        const allPools = [...result.rows, ...mockPools];
        
        // Sort pools: first by has_live_data (true comes first), then by name
        allPools.sort((a, b) => {
            // First sort by has_live_data (true comes first)
            if (a.has_live_data !== b.has_live_data) {
                return b.has_live_data ? 1 : -1;
            }
            // Then sort by name
            return a.pool_name.localeCompare(b.pool_name);
        });
        
        res.json(allPools);
    } catch (error) {
        console.error('Error fetching all pools:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/pools/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM swimming_pools WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pool not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching pool details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(degrees) {
    return degrees * (Math.PI/180);
}

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
}); 