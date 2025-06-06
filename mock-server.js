const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

// Enable CORS
app.use(cors());

// Base water quality data for each pool
const poolsData = {
    1: {
        water_quality: {
            temperature: 26.5,
            ph: 7.2,
            chlorine: 1.5
        },
        occupancy: {
            current: 12,
            max_capacity: 50
        }
    },
    2: {
        water_quality: {
            temperature: 27.0,
            ph: 7.4,
            chlorine: 1.8
        },
        occupancy: {
            current: 25,
            max_capacity: 75
        }
    },
    3: {
        water_quality: {
            temperature: 26.8,
            ph: 7.3,
            chlorine: 1.6
        },
        occupancy: {
            current: 20,
            max_capacity: 60
        }
    }
};

// Function to generate random variation within a range
function getRandomVariation(min, max) {
    return Math.random() * (max - min) + min;
}

// Function to update water quality data with small variations
function updateWaterQuality(poolData) {
    // Temperature variation: ±0.5°C
    poolData.water_quality.temperature = Math.max(24, Math.min(30, 
        poolData.water_quality.temperature + getRandomVariation(-0.5, 0.5)
    ));

    // pH variation: ±0.2
    poolData.water_quality.ph = Math.max(6.8, Math.min(7.8, 
        poolData.water_quality.ph + getRandomVariation(-0.2, 0.2)
    ));

    // Chlorine variation: ±0.3 ppm
    poolData.water_quality.chlorine = Math.max(1.0, Math.min(2.0, 
        poolData.water_quality.chlorine + getRandomVariation(-0.3, 0.3)
    ));

    // Occupancy variation: ±2 people
    poolData.occupancy.current = Math.max(0, Math.min(poolData.occupancy.max_capacity,
        poolData.occupancy.current + Math.round(getRandomVariation(-2, 2))
    ));

    // Round values to appropriate decimal places
    poolData.water_quality.temperature = Number(poolData.water_quality.temperature.toFixed(1));
    poolData.water_quality.ph = Number(poolData.water_quality.ph.toFixed(1));
    poolData.water_quality.chlorine = Number(poolData.water_quality.chlorine.toFixed(1));
}

// Update data every 30 seconds
setInterval(() => {
    Object.values(poolsData).forEach(updateWaterQuality);
}, 30000);

// Endpoint to get mock data for a specific pool
app.get('/api/pool-data/:id', (req, res) => {
    const poolId = req.params.id;
    if (poolsData[poolId]) {
        // Update data before sending response
        updateWaterQuality(poolsData[poolId]);
        res.json(poolsData[poolId]);
    } else {
        res.status(404).json({ error: 'Pool not found' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Mock server running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop the server');
}); 