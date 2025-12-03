// --- JS 邏輯區 (最新優化版：修正價量顯示問題) ---

// 1. 模擬資料庫
const mockData = {
    "2330": { name: "台積電", price: 578.00, change: 5.00, pct: 0.87, volume: 32450 },
    "2454": { name: "聯發科", price: 920.00, change: -10.00, pct: -1.08, volume: 4500 },
    "2603": { name: "長榮", price: 150.50, change: 2.50, pct: 1.69, volume: 89000 },
    "2317": { name: "鴻海", price: 101.50, change: 0.50, pct: 0.50, volume: 56000 }
};

// 全域變數
let kChartInstance = null;
let fullHistoryData = { labels: [], prices: [] };

// 搜尋功能入口
function searchStock() {
    const input = document.getElementById('stockInput').value.trim();
    const dashboard = document.getElementById('dashboard');
    
    if(!input) {
        alert("請輸入股票代號或名稱");
        return;
    }

    // 模擬載入效果
    dashboard.style.display = 'none';
    setTimeout(() => {
        // 1. 匹配資料
        let stockKey = "2330"; 
        if(input.includes("2454") || input.includes("聯發科")) stockKey = "2454";
        if(input.includes("2603") || input.includes("長榮")) stockKey = "2603";
        if(input.includes("2317") || input.includes("鴻海")) stockKey = "2317";

        const stock = mockData[stockKey];

        // 2. 生成歷史資料
        generateMockHistory(stock.price);

        // 3. 渲染主畫面
        renderDashboard(input, stock);
        
        // 4. 重置 UI
        document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.range-btn')[1].classList.add('active'); // 預設 1M

        dashboard.style.display = 'grid';
    }, 400);
}

// 產生歷史資料
function generateMockHistory(currentPrice) {
    const totalDays = 1260; 
    const labels = [];
    const prices = [];
    
    let tempPrices = [currentPrice];
    for(let i=1; i<totalDays; i++) {
        const prev = tempPrices[i-1];
        const change = (Math.random() - 0.5) * (prev * 0.03); 
        tempPrices.push(prev - change); 
    }
    prices.push(...tempPrices.reverse());

    let date = new Date();
    date.setDate(date.getDate() - totalDays);

    for (let i = 0; i < totalDays; i++) {
        while (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() + 1);
        }
        const dateStr = date.toISOString().split('T')[0];
        labels.push(dateStr);
        date.setDate(date.getDate() + 1);
    }
    
    const minLen = Math.min(labels.length, prices.length);
    fullHistoryData = { 
        labels: labels.slice(-minLen), 
        prices: prices.slice(-minLen) 
    };
}

// 渲染儀表板
function renderDashboard(query, stock) {
    // 基本資訊
    document.getElementById('stockName').innerText = `${stock.name} (${query.match(/\d+/) ? query : '2330'})`;
    const priceEl = document.getElementById('currentPrice');
    const changeEl = document.getElementById('priceChange');
    
    priceEl.innerText = stock.price.toFixed(2);
    if(stock.change > 0) {
        priceEl.className = "price-display text-up";
        changeEl.className = "price-change bg-up";
        changeEl.innerText = `▲ ${stock.change} (${stock.pct}%)`;
    } else {
        priceEl.className = "price-display text-down";
        changeEl.className = "price-change bg-down";
        changeEl.innerText = `▼ ${Math.abs(stock.change)} (${stock.pct}%)`;
    }
    document.getElementById('volume').innerText = stock.volume.toLocaleString();

    // 繪製 K 線圖
    updateTimeRange('1M');

    // ★ 渲染新的價量統計 (CSS 版)
    renderVolumeStats(stock.price);

    // 其他區塊
    renderOrderBook(stock.price);
    renderChips();
    renderAIAnalysis();
    renderNews(stock.name);
}

// 切換時間區間
function updateTimeRange(range, btnElement) {
    if(btnElement) {
        document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    const totalPoints = fullHistoryData.labels.length;
    let sliceCount = 22; 

    switch(range) {
        case '5D': sliceCount = 5; break;
        case '1M': sliceCount = 22; break;
        case '6M': sliceCount = 132; break;
        case 'YTD': 
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            const diffTime = Math.abs(new Date() - startOfYear);
            sliceCount = Math.floor(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) * 0.7); 
            break;
        case '1Y': sliceCount = 264; break;
        case '5Y': sliceCount = totalPoints; break;
        case 'MAX': sliceCount = totalPoints; break;
    }

    if (sliceCount > totalPoints) sliceCount = totalPoints;

    const viewLabels = fullHistoryData.labels.slice(-sliceCount);
    const viewPrices = fullHistoryData.prices.slice(-sliceCount);

    drawKChart(viewLabels, viewPrices);
}

// K 線圖繪製
function drawKChart(labels, data) {
    const ctx = document.getElementById('kLineChart').getContext('2d');
    
    if(kChartInstance) kChartInstance.destroy();

    kChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '收盤價',
                data: data,
                borderColor: '#ff333a',
                backgroundColor: 'rgba(255, 51, 58, 0.05)',
                borderWidth: 2,
                pointRadius: 0, 
                pointHoverRadius: 4,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    grid: { display: false },
                    ticks: { maxTicksLimit: 6, maxRotation: 0 } 
                },
                y: { grid: { color: '#f0f0f0' }, beginAtZero: false }
            },
            animation: { duration: 0 } 
        }
    });
}

// ★★★ 新功能：渲染價量力道與統計 (純 CSS，不耗效能) ★★★
function renderVolumeStats(currentPrice) {
    // 1. 隨機生成買賣比
    const buyPct = Math.floor(Math.random() * 40) + 30; // 模擬 30% ~ 70%
    const sellPct = 100 - buyPct;
    
    // 更新文字
    document.getElementById('buyPct').innerText = buyPct + '%';
    document.getElementById('sellPct').innerText = sellPct + '%';
    
    // 更新進度條寬度 (紅色部分)
    document.getElementById('sentimentBar').style.width = buyPct + '%';

    // 2. 模擬其他價量數據
    const turnover = (Math.random() * 50 + 10).toFixed(1); // 成交金額 10~60億
    const avgPrice = (currentPrice * (1 + (Math.random()-0.5)*0.01)).toFixed(2); // 均價
    const amplitude = (Math.random() * 2 + 0.5).toFixed(2); // 振幅
    const tickVol = Math.floor(Math.random() * 50); // 單量

    document.getElementById('turnover').innerText = turnover;
    document.getElementById('avgPrice').innerText = avgPrice;
    document.getElementById('amplitude').innerText = amplitude + '%';
    document.getElementById('tickVol').innerText = tickVol;
}

// 五檔
function renderOrderBook(basePrice) {
    const tbody = document.getElementById('orderBookBody');
    let html = '';
    for(let i=5; i>=1; i--) {
        const sellP = (basePrice + i*0.5).toFixed(2);
        const buyP = (basePrice - i*0.5).toFixed(2);
        html += `<tr><td class="text-up">${Math.floor(Math.random()*100)}</td><td class="text-up">${buyP}</td><td class="text-down">${sellP}</td><td class="text-down">${Math.floor(Math.random()*100)}</td></tr>`;
    }
    tbody.innerHTML = html;
}

// 籌碼
function renderChips() {
    const tbody = document.getElementById('chipsBody');
    const roles = ['主力', '外資', '投信', '自營商'];
    let html = '';
    roles.forEach(role => {
        const val = Math.floor((Math.random()-0.4)*2000);
        const color = val > 0 ? 'text-up' : 'text-down';
        html += `<tr><td style="text-align:left;padding-left:20px;">${role}</td><td class="${color}">${val>0?'+':''}${val}</td></tr>`;
    });
    tbody.innerHTML = html;
}

// AI
function renderAIAnalysis() {
    const getStars = () => '★'.repeat(3 + Math.floor(Math.random()*3)) + '☆'.repeat(2 - Math.floor(Math.random()*2));
    document.getElementById('starDay').innerText = getStars();
    document.getElementById('starShort').innerText = getStars();
    document.getElementById('starLong').innerText = getStars();
}

// 新聞
function renderNews(name) {
    const list = document.getElementById('newsList');
    list.innerHTML = `<div class="news-item"><span class="news-title">${name} 法說會報喜，營收超乎預期</span><span class="news-time">14:00</span></div><div class="news-item"><span class="news-title">外資連續三日買超 ${name}，目標價上調</span><span class="news-time">13:30</span></div>`;
}
