let currentPools = [];
let markers = [];
let map;

// Mock pools without live data
const mockPools = [
    {
        pool_name: "Aqua Paradise",
        address: "123 Main Road, Attapur",
        city: "Hyderabad",
        postal_code: "500018",
        api_endpoint: null
    },
    {
        pool_name: "Blue Wave Swimming Club",
        address: "45 Lake View Road, Attapur",
        city: "Hyderabad",
        postal_code: "500018",
        api_endpoint: null
    },
    {
        pool_name: "Crystal Clear Pool",
        address: "78 Waterfront Drive, Attapur",
        city: "Hyderabad",
        postal_code: "500018",
        api_endpoint: null
    },
    {
        pool_name: "Dolphin Swimming Academy",
        address: "90 Sports Complex Road, Attapur",
        city: "Hyderabad",
        postal_code: "500018",
        api_endpoint: null
    }
];

// Initialize map
function initMap() {
    map = L.map('map').setView([17.3850, 78.4867], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <p>${message}</p>
        <button onclick="searchPools()">Try Again</button>
    `;
    
    const poolsList = document.getElementById('poolList');
    poolsList.innerHTML = '';
    poolsList.appendChild(errorDiv);
}

// Update location display
function updateLocationDisplay(lat, lng) {
    if (map) {
        map.setView([lat, lng], 13);
    }
}

// Get user's current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
                    );
                    const data = await response.json();
                    resolve({
                        latitude,
                        longitude,
                        address: data.display_name,
                        city: data.address.city || data.address.town || data.address.village || 'Unknown',
                        area: data.address.suburb || data.address.neighbourhood || data.address.quarter || 'Unknown'
                    });
                } catch (error) {
                    reject(error);
                }
            },
            (error) => {
                reject(error);
            }
        );
    });
}

// Start location search (triggered by user interaction)
async function startLocationSearch() {
    try {
        const location = await getCurrentLocation();
        const poolsListHeading = document.getElementById('poolsHeading');
        const weatherBtn = document.querySelector('.weather-btn');
        
        // Extract area and city from location data
        const area = location.area || '';
        const city = location.city || '';
        
        // Update heading and show weather button
        poolsListHeading.textContent = `Swimming Pools in ${area}, ${city}`;
        weatherBtn.style.display = 'flex';
        
        updateLocationDisplay(location.latitude, location.longitude);
        await fetchNearbyPools(location.latitude, location.longitude);
    } catch (error) {
        console.error('Error getting location:', error);
        showError('Error getting your location. Please enable location services and try again.');
    }
}

// Initialize the application
async function init() {
    // Initialize map
    initMap();
    
    // Add click handler to search button
    const searchButton = document.querySelector('.search-box button');
    searchButton.addEventListener('click', searchPools);
    
    // Add click handler to search input (for Enter key)
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchPools();
        }
    });

    // Only start location search if search input is empty
    if (!searchInput.value) {
        await startLocationSearch();
    }
}

// Function to create pool marker
function createPoolMarker(pool) {
    if (!pool.latitude || !pool.longitude) {
        console.warn('Pool missing coordinates:', pool);
        return null;
    }

    const marker = L.marker([pool.latitude, pool.longitude]).addTo(map);
    
    const popupContent = document.createElement('div');
    popupContent.className = 'pool-popup';
    
    const nameElement = document.createElement('h3');
    nameElement.textContent = pool.pool_name;
    popupContent.appendChild(nameElement);
    
    const addressElement = document.createElement('p');
    addressElement.textContent = `${pool.address}, ${pool.city}, ${pool.postal_code}`;
    popupContent.appendChild(addressElement);
    
    if (pool.osm_data) {
        const osmInfo = document.createElement('div');
        osmInfo.className = 'osm-info';
        
        const tags = pool.osm_data.tags;
        if (tags) {
            if (tags.opening_hours) {
                const hoursElement = document.createElement('p');
                hoursElement.innerHTML = `<strong>Hours:</strong> ${tags.opening_hours}`;
                osmInfo.appendChild(hoursElement);
            }
            if (tags.phone) {
                const phoneElement = document.createElement('p');
                phoneElement.innerHTML = `<strong>Phone:</strong> ${tags.phone}`;
                osmInfo.appendChild(phoneElement);
            }
            if (tags.website) {
                const websiteElement = document.createElement('p');
                websiteElement.innerHTML = `<strong>Website:</strong> <a href="${tags.website}" target="_blank">${tags.website}</a>`;
                osmInfo.appendChild(websiteElement);
            }
        }
        
        popupContent.appendChild(osmInfo);
    }
    
    if (pool.has_live_data) {
        const liveDataElement = document.createElement('div');
        liveDataElement.className = 'live-data-indicator';
        liveDataElement.innerHTML = `
            <span class="live-dot"></span>
            <span>Live Data Available</span>
        `;
        popupContent.appendChild(liveDataElement);
        
        popupContent.addEventListener('click', () => {
            showPoolDetails(pool);
        });
    }
    
    marker.bindPopup(popupContent);
    return marker;
}

// Function to show loading state
function showLoading() {
    const poolList = document.getElementById('poolList');
    poolList.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading swimming pools...</div>
        </div>
    `;
}

// Function to fetch nearby pools
async function fetchNearbyPools(lat, lng) {
    try {
        showLoading();
        const response = await fetch(`/api/pools/nearby?lat=${lat}&lng=${lng}`);
        if (!response.ok) {
            throw new Error('Failed to fetch nearby pools');
        }
        const pools = await response.json();
        
        // Clear existing markers
        markers.forEach(marker => marker.remove());
        markers = [];
        
        // Add new markers
        pools.forEach(pool => {
            const marker = createPoolMarker(pool);
            if (marker) {
                markers.push(marker);
            }
        });
        
        // Update pool list
        updatePoolList(pools);
        
        // Update location display
        updateLocationDisplay(lat, lng);
    } catch (error) {
        console.error('Error fetching nearby pools:', error);
        showError('Failed to fetch nearby pools. Please try again.');
    }
}

// Function to update pool list
function updatePoolList(pools) {
    const poolList = document.getElementById('poolList');
    const poolsListHeading = document.getElementById('poolsHeading');
    const weatherBtn = document.querySelector('.weather-btn');
    const originalHeading = poolsListHeading.textContent;
    
    poolList.innerHTML = '';
    
    if (pools.length === 0) {
        // If no pools found in the searched location, fetch all pools from database
        fetch('/api/pools/all')
            .then(response => response.json())
            .then(databasePools => {
                if (databasePools.length > 0) {
                    // Keep the original heading (which includes the city name)
                    poolsListHeading.textContent = originalHeading;
                    weatherBtn.style.display = 'flex';
                    
                    // Create and add fallback message
                    const fallbackMessage = document.createElement('div');
                    fallbackMessage.className = 'fallback-message';
                    fallbackMessage.innerHTML = `
                        <p>No swimming pools found at the location. Try searching for a different location.</p>
                        <p>These are fallback swimming pools for demonstration.</p>
                    `;
                    poolList.appendChild(fallbackMessage);
                    
                    // Render the pool list after the message
                    renderPoolList(databasePools);
                } else {
                    poolsListHeading.textContent = 'No Swimming Pools Found';
                    weatherBtn.style.display = 'none';
                    poolList.innerHTML = '<p class="no-results">No swimming pools found.</p>';
                }
            })
            .catch(error => {
                console.error('Error fetching database pools:', error);
                poolsListHeading.textContent = 'Error Loading Pools';
                weatherBtn.style.display = 'none';
                poolList.innerHTML = '<p class="no-results">No swimming pools found.</p>';
            });
        return;
    }

    renderPoolList(pools);
}

function renderPoolList(pools) {
    const poolList = document.getElementById('poolList');
    const initialPools = pools.slice(0, 3);
    const remainingPools = pools.slice(3);

    // Don't clear the list if it already has a fallback message
    if (!poolList.querySelector('.fallback-message')) {
        poolList.innerHTML = '';
    }

    // Render initial pools
    initialPools.forEach(pool => {
        const poolCard = createPoolCard(pool);
        poolList.appendChild(poolCard);
    });

    // Add Show More button if there are more pools
    if (remainingPools.length > 0) {
        const showMoreBtn = document.createElement('button');
        showMoreBtn.className = 'show-more-btn';
        showMoreBtn.innerHTML = `Show More (${remainingPools.length})`;
        showMoreBtn.onclick = () => {
            // Clear the list but preserve fallback message
            const fallbackMessage = poolList.querySelector('.fallback-message');
            poolList.innerHTML = '';
            if (fallbackMessage) {
                poolList.appendChild(fallbackMessage);
            }
            
            // Show all pools
            pools.forEach(pool => {
                const poolCard = createPoolCard(pool);
                poolList.appendChild(poolCard);
            });

            // Add Show Less button
            const showLessBtn = document.createElement('button');
            showLessBtn.className = 'show-more-btn';
            showLessBtn.innerHTML = 'Show Less';
            showLessBtn.onclick = () => {
                // Clear the list but preserve fallback message
                const fallbackMessage = poolList.querySelector('.fallback-message');
                poolList.innerHTML = '';
                if (fallbackMessage) {
                    poolList.appendChild(fallbackMessage);
                }
                
                // Show initial pools
                initialPools.forEach(pool => {
                    const poolCard = createPoolCard(pool);
                    poolList.appendChild(poolCard);
                });
                
                // Add back the Show More button
                poolList.appendChild(showMoreBtn);
            };
            poolList.appendChild(showLessBtn);
        };
        poolList.appendChild(showMoreBtn);
    }
}

// Create pool card element
function createPoolCard(pool) {
    const poolCard = document.createElement('div');
    poolCard.className = 'pool-card';
    
    // Check if pool has live data
    const hasLiveData = pool.has_live_data;
    
    poolCard.innerHTML = `
        <div class="pool-info">
            <h3>${pool.pool_name}</h3>
            <p>${pool.address}, ${pool.city}, ${pool.postal_code}</p>
            ${pool.distance ? `<p class="distance">${pool.distance.toFixed(1)} km away</p>` : ''}
        </div>
        <div class="status ${hasLiveData ? 'live' : 'no-data'}">
            ${hasLiveData ? `
                <span class="live-indicator">
                    <span class="pulse"></span>
                    Live Data Available
                </span>
            ` : `
                <span class="no-data-indicator">
                    <i class="fas fa-info-circle"></i>
                    No Live Data
                </span>
            `}
        </div>
    `;
    
    // Add click event for all pools
    poolCard.addEventListener('click', () => {
        if (hasLiveData) {
            showPoolDetails(pool);
        } else {
            showPoolDetailsWithoutLiveData(pool);
        }
    });
    
    return poolCard;
}

// Show pool details without live data
function showPoolDetailsWithoutLiveData(pool) {
    const modal = document.getElementById('poolDetails');
    const content = document.getElementById('poolDetailsContent');
    
    content.innerHTML = `
        <h2>${pool.pool_name}</h2>
        <div class="pool-info">
            <p><strong>Address:</strong> ${pool.address}</p>
            <p><strong>City:</strong> ${pool.city}</p>
            <p><strong>Postal Code:</strong> ${pool.postal_code}</p>
            ${pool.osm_data && pool.osm_data.tags ? `
                ${pool.osm_data.tags.phone ? `<p><strong>Phone:</strong> ${pool.osm_data.tags.phone}</p>` : ''}
                ${pool.osm_data.tags.opening_hours ? `<p><strong>Hours:</strong> ${pool.osm_data.tags.opening_hours}</p>` : ''}
                ${pool.osm_data.tags.website ? `<p><strong>Website:</strong> <a href="${pool.osm_data.tags.website}" target="_blank">${pool.osm_data.tags.website}</a></p>` : ''}
            ` : ''}
        </div>
        <div class="no-live-data-message">
            <i class="fas fa-info-circle"></i>
            <p>Live water quality data is not available for this pool.</p>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Show pool details
async function showPoolDetails(pool) {
    const modal = document.getElementById('poolDetails');
    const content = document.getElementById('poolDetailsContent');
    
    try {
        // Show loading state
        content.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading pool details...</p>
            </div>
        `;
        modal.style.display = 'block';

        // Fetch initial data
        const liveData = await fetchLiveData(pool.api_endpoint);
        updatePoolDetails(pool, liveData);

        // Start auto-refresh
        startAutoRefresh(pool.api_endpoint);
    } catch (error) {
        console.error('Error fetching pool details:', error);
        content.innerHTML = '<p class="error-message">Error loading pool details. Please try again later.</p>';
    }
}

// Fetch live data
async function fetchLiveData(endpoint) {
    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

// Function to assess water quality
function assessWaterQuality(data) {
    const { temperature, ph, chlorine } = data.water_quality;
    let status = 'good';
    let issues = [];

    // Temperature assessment
    if (temperature < 24 || temperature > 30) {
        status = 'danger';
        issues.push('Temperature outside safe range (24-30°C)');
    } else if (temperature < 25 || temperature > 29) {
        status = 'warning';
        issues.push('Temperature approaching limits');
    }

    // pH assessment
    if (ph < 6.8 || ph > 7.8) {
        status = 'danger';
        issues.push('pH level outside safe range (6.8-7.8)');
    } else if (ph < 7.0 || ph > 7.6) {
        status = 'warning';
        issues.push('pH level approaching limits');
    }

    // Chlorine assessment
    if (chlorine < 1.0 || chlorine > 2.0) {
        status = 'danger';
        issues.push('Chlorine level outside safe range (1.0-2.0 ppm)');
    } else if (chlorine < 1.2 || chlorine > 1.8) {
        status = 'warning';
        issues.push('Chlorine level approaching limits');
    }

    return { status, issues };
}

// Update pool details in the UI
function updatePoolDetails(pool, liveData) {
    const content = document.getElementById('poolDetailsContent');
    const qualityAssessment = assessWaterQuality(liveData);
    
    content.innerHTML = `
        <h2>${pool.pool_name}</h2>
        <div class="pool-info">
            <p><strong>Address:</strong> ${pool.address}</p>
            <p><strong>City:</strong> ${pool.city}</p>
            <p><strong>Contact:</strong> ${pool.contact_number}</p>
            <p><strong>Email:</strong> ${pool.email}</p>
            <p><strong>Opening Hours:</strong> ${formatOpeningHours(pool.opening_hours)}</p>
        </div>
        <div class="water-quality-container">
            <div class="water-quality">
                <div class="live-indicator">
                    <span class="pulse"></span>
                    Live Data
                </div>
                <div class="quality-card">
                    <h4>Water Temperature</h4>
                    <p>${liveData.water_quality.temperature}°C</p>
                </div>
                <div class="quality-card">
                    <h4>pH Level</h4>
                    <p>${liveData.water_quality.ph}</p>
                </div>
                <div class="quality-card">
                    <h4>Chlorine Level</h4>
                    <p>${liveData.water_quality.chlorine} ppm</p>
                </div>
                <div class="quality-card">
                    <h4>Current Occupancy</h4>
                    <p>${liveData.occupancy.current}/${liveData.occupancy.max_capacity}</p>
                </div>
            </div>
            <div class="water-quality-guidelines">
                <h3>Water Quality Guidelines</h3>
                <div class="guideline-item">
                    <h4>Temperature</h4>
                    <p>Safe Range: 24-30°C<br>
                    Recommended: 26-28°C</p>
                </div>
                <div class="guideline-item">
                    <h4>pH Level</h4>
                    <p>Safe Range: 6.8-7.8<br>
                    Recommended: 7.2-7.6</p>
                </div>
                <div class="guideline-item">
                    <h4>Chlorine</h4>
                    <p>Safe Range: 1.0-2.0 ppm<br>
                    Recommended: 1.2-1.8 ppm</p>
                </div>
                <div class="overall-quality">
                    <h4>Overall Water Quality</h4>
                    <div class="quality-status ${qualityAssessment.status}">
                        ${qualityAssessment.status === 'good' ? 'Good' : 
                          qualityAssessment.status === 'warning' ? 'Needs Attention' : 'Action Required'}
                    </div>
                    ${qualityAssessment.issues.length > 0 ? `
                        <ul style="margin-top: 10px; color: #666; font-size: 0.9em;">
                            ${qualityAssessment.issues.map(issue => `<li>${issue}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            </div>
        </div>
        <div class="pool-features">
            <h3>Facilities</h3>
            <ul>
                ${pool.lifeguard_available ? '<li>Lifeguard Available</li>' : ''}
                ${pool.emergency_equipment_available ? '<li>Emergency Equipment Available</li>' : ''}
                ${pool.cctv_installed ? '<li>CCTV Installed</li>' : ''}
                ${pool.changing_rooms_available ? '<li>Changing Rooms Available</li>' : ''}
                ${pool.locker_facility ? '<li>Locker Facility Available</li>' : ''}
            </ul>
        </div>
    `;
}

// Auto-refresh live data
let refreshInterval;
function startAutoRefresh(endpoint) {
    // Clear any existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Refresh every 30 seconds
    refreshInterval = setInterval(async () => {
        try {
            const liveData = await fetchLiveData(endpoint);
            updateLiveData(liveData);
        } catch (error) {
            console.error('Error refreshing data:', error);
            clearInterval(refreshInterval);
        }
    }, 30000);
}

// Update live data in the UI
function updateLiveData(liveData) {
    const qualityCards = document.querySelectorAll('.quality-card p');
    if (qualityCards.length >= 4) {
        qualityCards[0].textContent = `${liveData.water_quality.temperature}°C`;
        qualityCards[1].textContent = liveData.water_quality.ph;
        qualityCards[2].textContent = `${liveData.water_quality.chlorine} ppm`;
        qualityCards[3].textContent = `${liveData.occupancy.current}/${liveData.occupancy.max_capacity}`;
    }
}

// Format opening hours
function formatOpeningHours(hours) {
    const parsed = typeof hours === 'string' ? JSON.parse(hours) : hours;
    return Object.entries(parsed)
        .map(([day, time]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${time}`)
        .join('<br>');
}

// Close modal
document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('poolDetails').style.display = 'none';
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('poolDetails');
    if (event.target === modal) {
        modal.style.display = 'none';
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    }
});

// Search pools
window.searchPools = async function() {
    const searchQuery = document.getElementById('searchInput').value;
    if (!searchQuery) {
        startLocationSearch();
        return;
    }

    try {
        showLoading();
        // First try to get coordinates for the search query
        const geocodeResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
        );
        const geocodeData = await geocodeResponse.json();

        if (geocodeData && geocodeData.length > 0) {
            const location = geocodeData[0];
            const poolsListHeading = document.getElementById('poolsHeading');
            const weatherBtn = document.querySelector('.weather-btn');
            
            // Safely extract area and city from location data
            let area = '';
            let city = '';
            
            if (location.address) {
                // Try to get area from various address fields
                area = location.address.suburb || 
                       location.address.neighbourhood || 
                       location.address.quarter || 
                       location.address.district || 
                       '';
                
                // Try to get city from various address fields
                city = location.address.city || 
                       location.address.town || 
                       location.address.village || 
                       location.address.state || 
                       '';
                
                // If we have a state but no city, use the state as city
                if (!city && location.address.state) {
                    city = location.address.state;
                }
            }
            
            // If we couldn't get area/city from address, try to parse from display_name
            if (!area || !city) {
                const parts = location.display_name.split(',');
                if (parts.length >= 2) {
                    // Take the first part as area
                    area = parts[0].trim();
                    // Look for Hyderabad in the display name
                    const hyderabadIndex = location.display_name.toLowerCase().indexOf('hyderabad');
                    if (hyderabadIndex !== -1) {
                        city = 'Hyderabad';
                    } else {
                        // If Hyderabad not found, take the second part as city
                        city = parts[1].trim();
                    }
                }
            }
            
            // Ensure we have Hyderabad as the city if we're in Hyderabad
            if (!city || city.toLowerCase().includes('ward')) {
                city = 'Hyderabad';
            }
            
            poolsListHeading.textContent = `Swimming Pools in ${area}, ${city}`;
            weatherBtn.style.display = 'flex';
            
            // Update map view
            updateLocationDisplay(parseFloat(location.lat), parseFloat(location.lon));
            
            // Fetch nearby pools using coordinates
            const response = await fetch(`/api/pools/nearby?lat=${location.lat}&lng=${location.lon}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const pools = await response.json();
            
            // Update pool list and map markers
            updatePoolList(pools);
            
            // Update map markers
            markers.forEach(marker => marker.remove());
            markers = [];
            pools.forEach(pool => {
                const marker = createPoolMarker(pool);
                if (marker) {
                    markers.push(marker);
                }
            });
        } else {
            // If no location found, try database search
            const response = await fetch(`/api/pools/search?query=${encodeURIComponent(searchQuery)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const pools = await response.json();
            
            const poolsListHeading = document.getElementById('poolsHeading');
            poolsListHeading.textContent = `Search Results for "${searchQuery}"`;
            weatherBtn.style.display = 'flex';
            
            updatePoolList(pools);
            
            // Update map markers
            markers.forEach(marker => marker.remove());
            markers = [];
            pools.forEach(pool => {
                const marker = createPoolMarker(pool);
                if (marker) {
                    markers.push(marker);
                }
            });
        }
    } catch (error) {
        console.error('Error searching pools:', error);
        showError('Error searching pools. Please try again later.');
    }
}

// Handle smooth scrolling and section highlighting
document.addEventListener('DOMContentLoaded', function() {
    // Handle all navigation links
    document.querySelectorAll('.nav-link').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                // Get the footer's position
                const footer = document.querySelector('footer');
                const footerTop = footer.offsetTop;
                
                // Scroll to the footer section
                window.scrollTo({
                    top: footerTop + targetSection.offsetTop - 100, // Offset for navbar
                    behavior: 'smooth'
                });
                
                // Add highlight animation
                targetSection.classList.add('highlight');
                
                // Remove highlight class after animation
                setTimeout(() => {
                    targetSection.classList.remove('highlight');
                }, 2500);
            }
        });
    });
});

// Initialize the application when the page loads
window.addEventListener('load', init);

// Navbar scroll effect
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
document.querySelector('.mobile-menu').addEventListener('click', function() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
});

// Weather functionality
let weatherUpdateInterval;

async function showWeather() {
    try {
        const location = await getCurrentLocation();
        const weatherModal = document.getElementById('weatherModal');
        const weatherContent = document.getElementById('weatherContent');
        
        // Show loading state
        weatherContent.innerHTML = '<div class="loading">Loading weather data...</div>';
        weatherModal.style.display = 'block';
        
        // Initial weather fetch
        await updateWeatherData(location);
        
        // Set up interval for live updates (every 5 minutes)
        weatherUpdateInterval = setInterval(async () => {
            await updateWeatherData(location);
        }, 300000); // 5 minutes in milliseconds
        
        // Add close button functionality
        const closeBtn = weatherModal.querySelector('.close');
        closeBtn.onclick = function() {
            weatherModal.style.display = 'none';
            clearInterval(weatherUpdateInterval); // Clear interval when modal is closed
        };
        
        // Close modal when clicking outside
        window.onclick = function(event) {
            if (event.target == weatherModal) {
                weatherModal.style.display = 'none';
                clearInterval(weatherUpdateInterval); // Clear interval when modal is closed
            }
        };
    } catch (error) {
        console.error('Error fetching weather:', error);
        const weatherContent = document.getElementById('weatherContent');
        weatherContent.innerHTML = `
            <div class="error-message">
                <p>Error loading weather data. Please try again.</p>
                <button onclick="showWeather()">Retry</button>
            </div>
        `;
    }
}

async function updateWeatherData(location) {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&units=metric&appid=21073ec5e62aee1754c24af954c0da54`);
        const data = await response.json();
        
        const weatherContent = document.getElementById('weatherContent');
        weatherContent.innerHTML = `
            <h2>Current Weather in ${location.city}</h2>
            <div class="weather-info">
                <div class="weather-main">
                    <div class="weather-icon-container">
                        <i class="fas ${getWeatherIcon(data.weather[0].main)} weather-icon"></i>
                        <div class="cloud-animation"></div>
                    </div>
                    <div class="temperature">${Math.round(data.main.temp)}°C</div>
                </div>
                <div class="weather-details">
                    <p class="description">${data.weather[0].description}</p>
                    <p class="humidity">Humidity: ${data.main.humidity}%</p>
                    <p class="wind">Wind: ${Math.round(data.wind.speed)} m/s</p>
                    <p class="last-updated">Last updated: ${new Date().toLocaleTimeString()}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error updating weather:', error);
    }
}

function getWeatherIcon(weatherMain) {
    const icons = {
        'Clear': 'fa-sun',
        'Clouds': 'fa-cloud',
        'Rain': 'fa-cloud-rain',
        'Drizzle': 'fa-cloud-rain',
        'Thunderstorm': 'fa-bolt',
        'Snow': 'fa-snowflake',
        'Mist': 'fa-smog',
        'Smoke': 'fa-smog',
        'Haze': 'fa-smog',
        'Dust': 'fa-smog',
        'Fog': 'fa-smog',
        'Sand': 'fa-smog',
        'Ash': 'fa-smog',
        'Squall': 'fa-wind',
        'Tornado': 'fa-wind'
    };
    
    return icons[weatherMain] || 'fa-cloud-sun';
} 