// --- JS 邏輯區 (Vercel Serverless 版) ---

// 全域變數
let kChartInstance = null;
let fullHistoryData = { labels: [], prices: [] };

// 搜尋功能入口
async function searchStock() {
    const input = document.getElementById('stockInput').value.trim();
    const dashboard = document.getElementById('dashboard');
    
    if(!input) {
        alert("請輸入股票代號或名稱");
        return;
    }

    // 顯示載入中... (可以用個 loading spinner 優化)
    document.getElementById('stockName').innerText = "資料讀取中...";
    dashboard.style.display = 'grid'; // 先顯示框架

    try {
        // ★★★ 關鍵修改：呼叫我們的 Vercel 後端 API ★★★
        // 自動判斷是否為數字，若是數字加上 .TW (簡單判斷台股)
        let querySymbol = input;
        if (/^\d+$/.test(input)) {
            querySymbol = input + ".TW";
        } else {
            // 如果輸入中文名稱，目前後端還沒做模糊搜尋，暫時提示使用者輸入代號
            // 這裡為了演示，如果輸入非數字，我們先預設轉成 2330.TW 避免錯誤，實際應做搜尋API
            if(input.includes("台積電")) querySymbol = "2330.TW";
            else if(input.includes("聯發科")) querySymbol = "2454.TW";
            else if(input.includes("長榮")) querySymbol = "2603.TW";
        }

        // 發送請求到我們剛剛建立的 /api
        const response = await fetch(`/api?symbol=${querySymbol}`);
        const stockData = await response.json();

        if (stockData.error) {
            alert("查無此股票或 API 錯誤: " + stockData.details);
            return;
        }

        // 成功！使用真實資料渲染
        // 生成模擬歷史資料 (因為免費版 Yahoo API 抓歷史資料較慢，我們先混合使用)
        // 之後可以在後端也把 historical data 抓回來
        generateMockHistory(stockData.price);

        renderDashboard(input, stockData);
        
        // 重置 UI
        document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.range-btn')[1].classList.add('active'); // 預設 1M

    } catch (err) {
        console.error(err);
        alert("連線發生錯誤，請稍後再試。");
    }
}

// 產生歷史資料 (目前仍保留模擬，若要真實歷史需在後端擴充)
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
    // 移除 .TW 讓顯示好看點
    const displayName = stock.name.replace('.TW', '');
    document.getElementById('stockName').innerText = `${displayName} (${query})`;
    
    const priceEl = document.getElementById('currentPrice');
    const changeEl = document.getElementById('priceChange');
    
    priceEl.innerText = stock.price.toFixed(2);
    
    // 處理漲跌顏色
    if(stock.change > 0) {
        priceEl.className = "price-display text-up";
        changeEl.className = "price-change bg-up";
        changeEl.innerText = `▲ ${stock.change.toFixed(2)} (${stock.pct.toFixed(2)}%)`;
    } else if (stock.change < 0) {
        priceEl.className = "price-display text-down";
        changeEl.className = "price-change bg-down";
        changeEl.innerText = `▼ ${Math.abs(stock.change).toFixed(2)} (${Math.abs(stock.pct).toFixed(2)}%)`;
    } else {
        priceEl.className = "price-display";
        changeEl.className = "price-change";
        changeEl.style.backgroundColor = "gray";
        changeEl.innerText = `- 0.00 (0.00%)`;
    }

    document.getElementById('volume').innerText = stock.volume ? stock.volume.toLocaleString() : "--";
    // 如果是股數，轉換成張數 (台灣習慣)
    if(stock.volume > 10000) {
        document.getElementById('volume').innerText = Math.floor(stock.volume / 1000).toLocaleString();
    }

    // 繪製 K 線圖
    updateTimeRange('1M');

    // ★ 渲染價量 (使用真實價格帶入運算模擬)
    renderVolumeStats(stock.price);

    // 其他區塊 (目前仍維持模擬，若要真實需擴充 API)
    renderOrderBook(stock.price);
    renderChips();
    renderAIAnalysis(); // 星星評分
    renderNews(displayName);
}

// 切換時間區間 (保持不變)
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

// K 線圖繪製 (保持不變)
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

// 價量力道與統計 (保持不變)
function renderVolumeStats(currentPrice) {
    const buyPct = Math.floor(Math.random() * 40) + 30; 
    const sellPct = 100 - buyPct;
    
    document.getElementById('buyPct').innerText = buyPct + '%';
    document.getElementById('sellPct').innerText = sellPct + '%';
    document.getElementById('sentimentBar').style.width = buyPct + '%';

    const turnover = (Math.random() * 50 + 10).toFixed(1); 
    const avgPrice = (currentPrice * (1 + (Math.random()-0.5)*0.01)).toFixed(2); 
    const amplitude = (Math.random() * 2 + 0.5).toFixed(2); 
    const tickVol = Math.floor(Math.random() * 50); 

    document.getElementById('turnover').innerText = turnover;
    document.getElementById('avgPrice').innerText = avgPrice;
    document.getElementById('amplitude').innerText = amplitude + '%';
    document.getElementById('tickVol').innerText = tickVol;
}

// 五檔 (保持不變)
function renderOrderBook(basePrice) {
    const tbody = document.getElementById('orderBookBody');
    let html = '';
    for(let i=5; i>=1; i--) {
        const sellP = (basePrice + i*0.005).toFixed(2); // 稍微縮小五檔價差
        const buyP = (basePrice - i*0.005).toFixed(2);
        html += `<tr><td class="text-up">${Math.floor(Math.random()*100)}</td><td class="text-up">${buyP}</td><td class="text-down">${sellP}</td><td class="text-down">${Math.floor(Math.random()*100)}</td></tr>`;
    }
    tbody.innerHTML = html;
}

// 籌碼 (保持不變)
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

// AI (保持不變)
function renderAIAnalysis() {
    const getStars = () => '★'.repeat(3 + Math.floor(Math.random()*3)) + '☆'.repeat(2 - Math.floor(Math.random()*2));
    document.getElementById('starDay').innerText = getStars();
    document.getElementById('starShort').innerText = getStars();
    document.getElementById('starLong').innerText = getStars();
}

// 新聞 (保持不變)
function renderNews(name) {
    const list = document.getElementById('newsList');
    list.innerHTML = `<div class="news-item"><span class="news-title">${name} 營收表現優於預期，法人看好</span><span class="news-time">14:00</span></div><div class="news-item"><span class="news-title">三大法人同步買超 ${name}，股價創新高</span><span class="news-time">13:30</span></div>`;
}
