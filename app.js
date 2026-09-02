let globalMarketData = null;
let currentChartInstances = [];

document.addEventListener('DOMContentLoaded', () => {
    // Timeframe Selector Logic
    document.getElementById('timeframe-selector').addEventListener('change', (e) => {
        if(globalMarketData) {
            renderData(globalMarketData, e.target.value);
        }
    });

    // Fetch and render data
    fetchData();
});

async function fetchData() {
    try {
        const response = await fetch('market_data.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error('Network response was not ok');
        globalMarketData = await response.json();

        // Update last updated text
        document.getElementById('last-updated').textContent = `Last updated: ${globalMarketData.last_updated}`;

        // Initial render with selected timeframe
        const tf = document.getElementById('timeframe-selector').value;
        renderData(globalMarketData, tf);

    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('last-updated').textContent = 'Error loading data';
        document.querySelector('.pulse-dot').style.display = 'none';
        document.getElementById('last-updated').style.color = '#ef4444';
    }
}

function sliceData(item, timeframe) {
    let days = 252; // default 1y
    if (timeframe === '3m') days = 63;
    if (timeframe === '6m') days = 126;
    if (timeframe === '1y') days = 252;
    if (timeframe === '3y') days = 756;
    if (timeframe === '5y') days = 9999; // whole array

    // Create a deep copy to avoid mutating global data
    const slicedItem = JSON.parse(JSON.stringify(item));
    
    const totalLen = slicedItem.history.data.length;
    const sliceLen = Math.min(days, totalLen);
    
    slicedItem.history.labels = slicedItem.history.labels.slice(-sliceLen);
    slicedItem.history.data = slicedItem.history.data.slice(-sliceLen);
    
    // Recalculate stats based on sliced data
    const dataArr = slicedItem.history.data;
    if(dataArr.length > 0) {
        slicedItem.current = dataArr[dataArr.length - 1];
        
        slicedItem.stats.high = Math.max(...dataArr);
        slicedItem.stats.low = Math.min(...dataArr);
        
        const sum = dataArr.reduce((a,b) => a+b, 0);
        slicedItem.stats.mean = sum / dataArr.length;
        
        const sorted = [...dataArr].sort((a,b) => a-b);
        const mid = Math.floor(sorted.length / 2);
        slicedItem.stats.median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    
    return slicedItem;
}

function renderData(data, timeframe) {
    // Destroy old charts to prevent memory leaks
    currentChartInstances.forEach(chart => chart.destroy());
    currentChartInstances = [];

    // Clear existing grid
    document.getElementById('metals-grid').innerHTML = '';
    
    document.querySelector('.pulse-dot').style.display = 'none';
    document.getElementById('last-updated').style.color = 'var(--text-primary)';

    // Render Metals
    const metalsGrid = document.getElementById('metals-grid');
    if(data.metals) {
        data.metals.forEach(item => {
            createCard(sliceData(item, timeframe), metalsGrid, timeframe);
        });
    }
}

function createCard(item, container, timeframe = '1y') {
    const template = document.getElementById('card-template');
    const clone = template.content.cloneNode(true);

    // Populate data
    clone.querySelector('.card-title').textContent = item.name;
    
    let unitStr = ' (USD / 1oz)';
    if (item.symbol === 'GLD') unitStr = ' (USD / ~0.1oz)';
    clone.querySelector('.card-symbol').textContent = item.symbol + unitStr;
    
    // Format appropriately (avoid .00 for large numbers, but keep precision for small)
    const currentVal = item.current < 10 ? item.current.toFixed(4) : item.current.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    clone.querySelector('.card-current').textContent = currentVal;
    
    const changeEl = clone.querySelector('.card-change');
    const changeText = item.change_percent > 0 ? `▲ +${item.change_percent}%` : `▼ ${item.change_percent}%`;
    changeEl.textContent = changeText;
    changeEl.classList.add(item.change_percent > 0 ? 'up' : 'down');

    // Calculate per-gram price
    const perGramEl = clone.querySelector('.card-per-gram');
    
    // Determine how many ounces one unit (share/contract) represents
    let ozEquivalent = 1; // Default for Futures (GC=F, SI=F)
    if (item.symbol === 'GLD') {
        // GLD started at 0.1 oz, but due to annual expense ratio (0.4%) decay over 20+ years,
        // it now represents approximately 0.0904 oz.
        ozEquivalent = 0.0904; 
    } else if (item.symbol === 'SLV') {
        // SLV started at 1 oz, but due to annual expense ratio decay,
        // it now represents approximately 0.9077 oz.
        ozEquivalent = 0.9077;
    }
    
    const ozInGrams = 31.1034768;
    const gramsPerUnit = ozEquivalent * ozInGrams;
    
    const pricePerGramUSD = item.current / gramsPerUnit;
    const pricePerGramKRW = pricePerGramUSD * globalMarketData.usd_krw;
    
    perGramEl.style.display = 'block';
    perGramEl.innerHTML = `⚖️ 1g당: <strong>$${pricePerGramUSD.toFixed(2)}</strong> <span style="margin: 0 6px; opacity: 0.3;">|</span> <strong>₩${Math.round(pricePerGramKRW).toLocaleString()}</strong> <span style="font-size: 0.8em; opacity: 0.7; margin-left: 4px;">(환율: ₩${Math.round(globalMarketData.usd_krw).toLocaleString()})</span>`;

    // Return the actual div.card element (save reference before appending)
    const cardEl = clone.firstElementChild;
    const canvas = cardEl.querySelector('canvas');
    
    // **CRITICAL FIX**: Append to DOM BEFORE creating Chart.js
    container.appendChild(clone);

    const isUp = item.change_percent > 0;

    // Update stat labels based on timeframe
    let labelPrefix = '1년';
    if(timeframe === '3m') labelPrefix = '3개월';
    if(timeframe === '6m') labelPrefix = '6개월';
    if(timeframe === '1y') labelPrefix = '1년';
    if(timeframe === '3y') labelPrefix = '3년';
    if(timeframe === '5y') labelPrefix = '5년';

    const labels = cardEl.querySelectorAll('.stat-label');
    if (labels.length >= 4) {
        labels[0].textContent = `${labelPrefix} 평균`;
        labels[1].textContent = `${labelPrefix} 중앙값`;
        labels[2].textContent = `${labelPrefix} 최고`;
        labels[3].textContent = `${labelPrefix} 최저`;
    }

    // Populate stats
    if (item.stats) {
        const p = item.current < 10 ? 4 : 2;
        cardEl.querySelector('.stat-mean').textContent = item.stats.mean.toLocaleString(undefined, {minimumFractionDigits: p, maximumFractionDigits: p});
        cardEl.querySelector('.stat-median').textContent = item.stats.median.toLocaleString(undefined, {minimumFractionDigits: p, maximumFractionDigits: p});
        cardEl.querySelector('.stat-high').textContent = item.stats.high.toLocaleString(undefined, {minimumFractionDigits: p, maximumFractionDigits: p});
        cardEl.querySelector('.stat-low').textContent = item.stats.low.toLocaleString(undefined, {minimumFractionDigits: p, maximumFractionDigits: p});
    }

    // Korean style colors
    const color = isUp ? '#ef4444' : '#3b82f6'; 
    const bgColor = isUp ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)';

    const chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: item.history.labels,
            datasets: [{
                data: item.history.data,
                borderColor: color,
                backgroundColor: bgColor,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#94a3b8',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { 
                    display: false,
                    // Dynamic min/max to make the trend more pronounced
                    min: Math.min(...item.history.data) * 0.98,
                    max: Math.max(...item.history.data) * 1.02
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
    currentChartInstances.push(chart);
}
