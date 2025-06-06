require('dotenv').config();
const { Pool } = require('pg');

// Create a connection to PostgreSQL server (without specifying database)
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: 'postgres' // Connect to default postgres database first
});

// Mock data for swimming pools
const mockPools = [
    {
        pool_name: "Aqua Swimming Pool",
        address: "123 Main Road, Attapur",
        city: "Hyderabad",
        postal_code: "500018",
        latitude: 17.3850,
        longitude: 78.4867,
        api_endpoint: null,
        contact_number: "Not available",
        email: "Not available",
        opening_hours: {
            monday: "9:00 AM - 6:00 PM",
            tuesday: "9:00 AM - 6:00 PM",
            wednesday: "9:00 AM - 6:00 PM",
            thursday: "9:00 AM - 6:00 PM",
            friday: "9:00 AM - 6:00 PM",
            saturday: "9:00 AM - 6:00 PM",
            sunday: "9:00 AM - 6:00 PM"
        },
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
        contact_number: "Not available",
        email: "Not available",
        opening_hours: {
            monday: "8:00 AM - 7:00 PM",
            tuesday: "8:00 AM - 7:00 PM",
            wednesday: "8:00 AM - 7:00 PM",
            thursday: "8:00 AM - 7:00 PM",
            friday: "8:00 AM - 7:00 PM",
            saturday: "8:00 AM - 7:00 PM",
            sunday: "8:00 AM - 7:00 PM"
        },
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
        contact_number: "Not available",
        email: "Not available",
        opening_hours: {
            monday: "7:00 AM - 8:00 PM",
            tuesday: "7:00 AM - 8:00 PM",
            wednesday: "7:00 AM - 8:00 PM",
            thursday: "7:00 AM - 8:00 PM",
            friday: "7:00 AM - 8:00 PM",
            saturday: "7:00 AM - 8:00 PM",
            sunday: "7:00 AM - 8:00 PM"
        },
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
        contact_number: "Not available",
        email: "Not available",
        opening_hours: {
            monday: "7:00 AM - 9:00 PM",
            tuesday: "7:00 AM - 9:00 PM",
            wednesday: "7:00 AM - 9:00 PM",
            thursday: "7:00 AM - 9:00 PM",
            friday: "7:00 AM - 9:00 PM",
            saturday: "8:00 AM - 8:00 PM",
            sunday: "8:00 AM - 8:00 PM"
        },
        lifeguard_available: true,
        emergency_equipment_available: true,
        cctv_installed: true,
        changing_rooms_available: true,
        locker_facility: true
    }
];

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        // Create database if it doesn't exist
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${process.env.DB_NAME}') THEN
                    CREATE DATABASE ${process.env.DB_NAME};
                END IF;
            END $$;
        `);

        // Connect to the new database
        await client.query(`\c ${process.env.DB_NAME}`);

        // Create swimming_pools table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS swimming_pools (
                id SERIAL PRIMARY KEY,
                pool_name VARCHAR(255) NOT NULL,
                address TEXT NOT NULL,
                city VARCHAR(100) NOT NULL,
                postal_code VARCHAR(20),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                api_endpoint TEXT,
                contact_number VARCHAR(20),
                email VARCHAR(255),
                opening_hours JSONB,
                lifeguard_available BOOLEAN DEFAULT false,
                emergency_equipment_available BOOLEAN DEFAULT false,
                cctv_installed BOOLEAN DEFAULT false,
                changing_rooms_available BOOLEAN DEFAULT false,
                locker_facility BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_pool_name ON swimming_pools(pool_name);
            CREATE INDEX IF NOT EXISTS idx_city ON swimming_pools(city);
            CREATE INDEX IF NOT EXISTS idx_coordinates ON swimming_pools USING gist (
                ll_to_earth(latitude, longitude)
            );
        `);

        // Check if table is empty
        const { rows } = await client.query('SELECT COUNT(*) FROM swimming_pools');
        if (parseInt(rows[0].count) === 0) {
            // Insert mock data
            for (const pool of mockPools) {
                await client.query(`
                    INSERT INTO swimming_pools (
                        pool_name, address, city, postal_code, latitude, longitude,
                        api_endpoint, contact_number, email, opening_hours,
                        lifeguard_available, emergency_equipment_available,
                        cctv_installed, changing_rooms_available, locker_facility
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                `, [
                    pool.pool_name,
                    pool.address,
                    pool.city,
                    pool.postal_code,
                    pool.latitude,
                    pool.longitude,
                    pool.api_endpoint,
                    pool.contact_number,
                    pool.email,
                    JSON.stringify(pool.opening_hours),
                    pool.lifeguard_available,
                    pool.emergency_equipment_available,
                    pool.cctv_installed,
                    pool.changing_rooms_available,
                    pool.locker_facility
                ]);
            }
            console.log('Mock data inserted successfully!');
        }

        console.log('Database and tables initialized successfully!');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the initialization
initializeDatabase().catch(console.error); 