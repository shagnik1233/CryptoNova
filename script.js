// ====== STATE ======
let globalData = {};
let topCoins = [];
let trendingCoins = [];
let updateInterval = null;

// ====== DOM ELEMENTS ======
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.page-section');
const searchInput = document.getElementById('searchInput');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const mobileNavLinks = document.querySelector('.nav-links');

// Containers
const globalMarketCapEl = document.getElementById('globalMarketCap');
const globalVolumeEl = document.getElementById('globalVolume');
const btcDominanceEl = document.getElementById('btcDominance');
const topMoversContainer = document.getElementById('topMoversContainer');
const marketTableBody = document.getElementById('marketTableBody');
const trendingContainer = document.getElementById('trendingContainer');

// ====== EVENT LISTENERS ======

// SPA Routing Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-target');

        // Update active link
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Close mobile menu if open
        mobileNavLinks.classList.remove('show');

        // Update active section
        sections.forEach(sec => {
            sec.classList.remove('active');
            if (sec.id === targetId) {
                sec.classList.add('active');
            }
        });

        // Load data based on section
        if (targetId === 'markets') renderMarketTable(topCoins);
        if (targetId === 'trending' && trendingCoins.length === 0) fetchTrending();
    });
});

// Mobile menu toggle
mobileMenuBtn.addEventListener('click', () => {
    mobileNavLinks.classList.toggle('show');
});

// Search functionality
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();

    // Auto-switch to markets tab if searching
    if (searchTerm.length > 0) {
        // Find the 'Markets' link and click it to switch the view
        const marketsLink = document.querySelector('[data-target="markets"]');
        if (!marketsLink.classList.contains('active')) {
            marketsLink.click();
        }

        const filteredCoins = topCoins.filter(coin =>
            coin.name.toLowerCase().includes(searchTerm) ||
            coin.symbol.toLowerCase().includes(searchTerm)
        );
        renderMarketTable(filteredCoins);
    } else {
        renderMarketTable(topCoins);
    }
});


// ====== FORMATTING UTILS ======
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
const formatCompactNumber = (number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(number);
const formatPercentage = (val) => `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;

const getChangeClass = (val) => val >= 0 ? 'positive' : 'negative';
const getChangeIcon = (val) => val >= 0 ? '<i class="fa-solid fa-arrow-trend-up"></i>' : '<i class="fa-solid fa-arrow-trend-down"></i>';

// ====== API FETCHES ======

// Fetch Global Data
async function fetchGlobalData() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/global');
        const data = await res.json();

        globalData = data.data;

        globalMarketCapEl.textContent = formatCurrency(globalData.total_market_cap.usd);
        globalVolumeEl.textContent = formatCurrency(globalData.total_volume.usd);
        btcDominanceEl.textContent = formatPercentage(globalData.market_cap_percentage.btc);

    } catch (err) {
        console.error("Error fetching global data:", err);
        globalMarketCapEl.textContent = "N/A";
        globalVolumeEl.textContent = "N/A";
        btcDominanceEl.textContent = "N/A";
    }
}

// Fetch Top Coins (Markets & Home)
async function fetchTopCoins() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false');
        if (!res.ok) throw new Error("Rate limit or server error");
        topCoins = await res.json();

        // Render Top Movers (Home Phase)
        // Sort by price change percentage desc, but ensuring reasonable volume to avoid low cap coins
        const movers = [...topCoins]
            .filter(c => c.total_volume > 10000000)
            .sort((a, b) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h))
            .slice(0, 4);

        renderCards(topMoversContainer, movers);

        // Render Market Table if on markets tab
        if (document.getElementById('markets').classList.contains('active')) {
            renderMarketTable(topCoins);
        }

    } catch (err) {
        console.error("Error fetching top coins:", err);
        topMoversContainer.innerHTML = '<p class="error">Failed to load market data. Please try again later.</p>';
        marketTableBody.innerHTML = '<tr><td colspan="5" class="error">Failed to load market data.</td></tr>';
    }
}

// Fetch Trending Coins
async function fetchTrending() {
    if (trendingContainer.innerHTML.includes('loader') === false && trendingCoins.length > 0) return;

    try {
        trendingContainer.innerHTML = '<div class="loader"></div>';
        const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
        const data = await res.json();

        trendingCoins = data.coins.slice(0, 8).map(c => ({
            id: c.item.id,
            symbol: c.item.symbol,
            name: c.item.name,
            image: c.item.large,
            current_price: c.item.data.price,
            price_change_percentage_24h: c.item.data.price_change_percentage_24h.usd
        }));

        renderCards(trendingContainer, trendingCoins, true);

    } catch (err) {
        console.error("Error fetching trending coins:", err);
        trendingContainer.innerHTML = '<p class="error">Failed to load trending data.</p>';
    }
}

// ====== RENDERERS ======

// Render Grid Cards
function renderCards(container, coins, isTrending = false) {
    container.innerHTML = '';

    coins.forEach(coin => {
        const change = coin.price_change_percentage_24h || 0;
        const changeClass = getChangeClass(change);
        const changeIcon = getChangeIcon(change);

        // Format price depending on if it's trending (might be in BTC or USD string already)
        let priceStr = isTrending && typeof coin.current_price === 'string'
            ? coin.current_price // Coingecko trending API sometimes returns string format
            : formatCurrency(coin.current_price);

        const card = document.createElement('div');
        card.className = 'coin-card';
        card.innerHTML = `
            <div class="card-header">
                <img src="${coin.image}" alt="${coin.name}">
                <div class="card-title">
                    <h3>${coin.name}</h3>
                    <span>${coin.symbol}</span>
                </div>
            </div>
            <div class="card-price">${priceStr}</div>
            <div class="card-change ${changeClass}">
                ${changeIcon} ${formatPercentage(change)}
            </div>
        `;
        container.appendChild(card);
    });
}

// Render Market Table
function renderMarketTable(coins) {
    marketTableBody.innerHTML = '';

    if (coins.length === 0) {
        marketTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No coins found</td></tr>';
        return;
    }

    coins.forEach(coin => {
        const change = coin.price_change_percentage_24h || 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="coin-col">
                    <img src="${coin.image}" alt="${coin.name}">
                    <span class="coin-name">${coin.name}</span>
                    <span class="coin-symbol">${coin.symbol}</span>
                </div>
            </td>
            <td>${formatCurrency(coin.current_price)}</td>
            <td class="${getChangeClass(change)}">${getChangeIcon(change)} ${formatPercentage(change)}</td>
            <td>$${formatCompactNumber(coin.market_cap)}</td>
            <td>$${formatCompactNumber(coin.total_volume)}</td>
        `;
        marketTableBody.appendChild(tr);
    });
}

// ====== INIT ======
async function init() {
    await fetchGlobalData();
    await fetchTopCoins();

    // Refresh data every 60 seconds
    updateInterval = setInterval(() => {
        fetchGlobalData();
        fetchTopCoins();
        if (document.getElementById('trending').classList.contains('active')) {
            fetchTrending();
        }
    }, 60000);
}

// Start application
init();