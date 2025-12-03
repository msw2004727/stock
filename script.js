// --- JS 邏輯區 ---

// 1. 模擬資料 (Mock Data)
const mockData = {
    "2330": { name: "台積電", price: 578.00, change: 5.00, pct: 0.87, volume: 32450 },
    "2454": { name: "聯發科", price: 920.00, change: -10.00, pct: -1.08, volume: 4500 },
    "2603": { name: "長榮", price: 150.50, change: 2.50, pct: 1.69, volume: 89000 }
};

// Chart.js 實例變數
let kChartInstance = null;
let volChartInstance = null;

// 搜尋功能
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
        renderDashboard(input);
        dashboard.style.display = 'grid';
    }, 500);
}

// 渲染主畫面
function renderDashboard(query) {
    // 這裡做簡單的模擬匹配，實際需接後端 API
    let stock = mockData["2330"]; // 預設顯示台積電作為 Demo
    if(query.includes("2454") || query.includes("聯發科")) stock = mockData["2454"];
    if(query.includes("2603") || query.includes("長榮")) stock = mockData["2603"];

    // 1. 更新基本資訊
    document.getElementById('stockName').innerText = `${stock.name} (${query.match(/\d+/) ? query : '2330'})`; // 簡單模擬代號
    
    const priceEl = document.getElementById('currentPrice');
    const changeEl = document.getElementById('priceChange');
    
    priceEl.innerText = stock.price.toFixed(2);
    
    // 判斷顏色
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

    // 2. 更新圖表
    renderCharts();
    
    // 3. 更新五檔 (生成隨機數值模擬)
    renderOrderBook(stock.price);

    // 4. 更新籌碼
    renderChips();

    // 5. 更新 AI 分析 (隨機生成模擬)
    renderAIAnalysis();

    // 6. 更新新聞
    renderNews(stock.name);
}

// 渲染圖表 (Chart.js)
function renderCharts() {
    const ctxK = document.getElementById('kLineChart').getContext('2d');
    
    // 銷毀舊圖表以防重疊
    if(kChartInstance) kChartInstance.destroy();

    // 模擬 K 線數據 (隨機生成 30 天)
    const labels = Array.from({length: 30}, (_, i) => `11/${i+1}`);
    const data = Array.from({length: 30}, () => 500 + Math.random() * 100);

    kChartInstance = new Chart(ctxK, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '收盤價',
                data: data,
                borderColor: '#ff333a',
                backgroundColor: 'rgba(255, 51, 58, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: false }
            }
        }
    });

    // 簡單的量能 Bar
    const ctxV = document.getElementById('volumeChart').getContext('2d');
    if(volChartInstance) volChartInstance.destroy();
    
    volChartInstance = new Chart(ctxV, {
        type: 'bar',
        data: {
            labels: ['買盤力道', '賣盤力道'],
            datasets: [{
                label: '量能',
                data: [65, 35], // 模擬數據
                backgroundColor: ['#ff333a', '#00aa00']
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// 渲染五檔
function renderOrderBook(basePrice) {
    const tbody = document.getElementById('orderBookBody');
    let html = '';
    for(let i=5; i>=1; i--) {
        const sellPrice = (basePrice + i*0.5).toFixed(1);
        const buyPrice = (basePrice - i*0.5).toFixed(1);
        const sellVol = Math.floor(Math.random() * 100);
        const buyVol = Math.floor(Math.random() * 100);
        
        html += `
            <tr>
                <td class="text-up">${buyVol}</td>
                <td class="text-up">${buyPrice}</td>
                <td class="text-down">${sellPrice}</td>
                <td class="text-down">${sellVol}</td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

// 渲染籌碼
function renderChips() {
    const tbody = document.getElementById('chipsBody');
    const roles = ['主力', '外資', '投信', '自營商'];
    let html = '';
    
    roles.forEach(role => {
        const val = Math.floor((Math.random() - 0.4) * 2000); // 隨機正負
        const colorClass = val > 0 ? 'text-up' : 'text-down';
        html += `
            <tr>
                <td style="text-align:left; padding-left:20px;">${role}</td>
                <td class="${colorClass}">${val > 0 ? '+' : ''}${val}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// 渲染 AI
function renderAIAnalysis() {
    const getStars = () => '★'.repeat(Math.floor(Math.random() * 3) + 3) + '☆'.repeat(5 - (Math.floor(Math.random() * 3) + 3));
    document.getElementById('starDay').innerText = getStars();
    document.getElementById('starShort').innerText = getStars();
    document.getElementById('starLong').innerText = getStars();
}

// 渲染新聞
function renderNews(stockName) {
    const newsList = document.getElementById('newsList');
    const titles = [
        `${stockName} 營收創新高，法人看好後市`,
        `外資連續買超 ${stockName}，目標價上調`,
        `產業復甦強勁，${stockName} 成為領頭羊`
    ];
    
    let html = '';
    titles.forEach(title => {
        html += `
            <div class="news-item">
                <span class="news-title">${title}</span>
                <span class="news-time">2023-12-03 14:30 · 財經新聞網</span>
            </div>
        `;
    });
    newsList.innerHTML = html;
}
