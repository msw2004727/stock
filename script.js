// --- JS 邏輯區 (Vercel Serverless + 1D K線 + AI 多模型版) ---

let kChartInstance = null;
let fullHistoryData = { labels: [], prices: [] };
let currentStockData = null; // 暫存當前股票數據給 1D 圖表用

// 搜尋功能入口
async function searchStock() {
    const input = document.getElementById('stockInput').value.trim();
    const dashboard = document.getElementById('dashboard');
    
    if(!input) {
        alert("請輸入股票代號或名稱");
        return;
    }

    document.getElementById('stockName').innerText = "AI 數據運算中...";
    dashboard.style.display = 'grid';

    try {
        let querySymbol = input;
        if (/^\d+$/.test(input)) {
            querySymbol = input + ".TW";
        } else {
            // 簡單對應測試用，實際建議後端處理模糊搜尋
            if(input.includes("台積電")) querySymbol = "2330.TW";
            else if(input.includes("聯發科")) querySymbol = "2454.TW";
            else if(input.includes("長榮")) querySymbol = "2603.TW";
            else if(input.includes("鴻海")) querySymbol = "2317.TW";
            else if(input.includes("廣達")) querySymbol = "2382.TW";
        }

        // 呼叫後端 API
        const response = await fetch(`/api?symbol=${querySymbol}`);
        const stockData = await response.json();

        if (stockData.error) {
            alert("查無資料，請確認代號是否正確");
            document.getElementById('stockName').innerText = "查無資料";
            return;
        }

        currentStockData = stockData; 

        // 1. 生成歷史資料 (模擬長線)
        generateMockHistory(stockData.price);
        
        // 2. 渲染畫面
        renderDashboard(input, stockData);
        
        // 3. 預設顯示 1D (當日)
        document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.range-btn')[0].classList.add('active'); 
        updateTimeRange('1D'); 

    } catch (err) {
        console.error(err);
        alert("連線錯誤，請稍後再試");
    }
}

// 渲染儀表板
function renderDashboard(query, stock) {
    // 基本資訊
    const displayName = stock.name.replace('.TW', '');
    document.getElementById('stockName').innerText = `${displayName} (${query})`;
    document.getElementById('dataDate').innerText = new Date().toLocaleDateString();

    const priceEl = document.getElementById('currentPrice');
    const changeEl = document.getElementById('priceChange');
    
    priceEl.innerText = stock.price.toFixed(2);
    
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

    const volText = stock.volume > 10000 ? Math.floor(stock.volume/1000).toLocaleString() : stock.volume.toLocaleString();
    document.getElementById('volume').innerText = volText;

    // 價量數據
    renderVolumeStats(stock.price);
    renderOrderBook(stock.price);
    renderChips();

    // ★★★ 更新 AI 卡片 ★★★
    if (stock.aiAnalysis && stock.aiAnalysis.opinions) {
        const ai = stock.aiAnalysis.opinions;
        updateAICard('gemini', ai.gemini);
        updateAICard('gpt', ai.gpt);
        updateAICard('deepseek', ai.deepseek);
        document.getElementById('aiSummaryText').innerText = stock.aiAnalysis.summary;
    }

    // ★★★ 更新新聞 ★★★
    const newsList = document.getElementById('newsList');
    let newsHtml = '';
    if (stock.news && stock.news.length > 0) {
        stock.news.forEach(item => {
            newsHtml += `
                <div class="news-item">
                    <a href="${item.link}" target="_blank" class="news-title">${item.title}</a>
                    <div class="news-meta">
                        <span class="news-source">${item.publisher}</span>
                        <span class="news-time">${item.time}</span>
                    </div>
                </div>`;
        });
    } else {
        newsHtml = '<div style="padding:10px; color:#888;">暫無相關新聞</div>';
    }
    newsList.innerHTML = newsHtml;
}

// 更新單張 AI 卡片
function updateAICard(id, data) {
    if(!data) return;
    document.getElementById(`${id}-view`).innerText = data.view;
    document.getElementById(`${id}-desc`).innerText = data.desc;
    const stars = Math.round(data.score / 20);
    const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    document.getElementById(`${id}-stars`).innerText = starStr;
}

// 切換時間區間 (含 1D 邏輯)
function updateTimeRange(range, btnElement) {
    if(btnElement) {
        document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    let labels, data;

    if (range === '1D') {
        // 生成當日走勢
        const intraday = generateIntradayData(currentStockData);
        labels = intraday.labels;
        data = intraday.data;
    } else {
        // 歷史資料
        const totalPoints = fullHistoryData.labels.length;
        let sliceCount = 22; 
        switch(range) {
            case '5D': sliceCount = 5; break;
            case '1M': sliceCount = 22; break;
            case '6M': sliceCount = 132; break;
            case 'YTD': sliceCount = 100; break;
            case '1Y': sliceCount = 264; break;
            case '5Y': sliceCount = totalPoints; break;
            case 'MAX': sliceCount = totalPoints; break;
        }
        if (sliceCount > totalPoints) sliceCount = totalPoints;
        labels = fullHistoryData.labels.slice(-sliceCount);
        data = fullHistoryData.prices.slice(-sliceCount);
    }

    drawKChart(labels, data, range === '1D');
}

// 生成當日走勢 (模擬)
function generateIntradayData(stock) {
    const labels = [];
    const data = [];
    if(!stock) return { labels: [], data: [] };

    let current = stock.open || stock.prevClose; 
    const target = stock.price;
    const totalMinutes = 270; // 4.5小時
    
    for (let i = 0; i <= totalMinutes; i++) {
        const hour = 9 + Math.floor(i / 60);
        const minute = i % 60;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        if (i % 30 === 0) labels.push(timeStr);
        else labels.push(''); 

        const progress = i / totalMinutes;
        const randomFluctuation = (Math.random() - 0.5) * (stock.price * 0.005); 
        let simPrice = current + (target - current) * progress + randomFluctuation;
        data.push(simPrice);
    }
    data[data.length-1] = stock.price; // 確保收在現價
    return { labels, data };
}

function drawKChart(labels, data, isIntraday) {
    const ctx = document.getElementById('kLineChart').getContext('2d');
    if(kChartInstance) kChartInstance.destroy();

    kChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '價格',
                data: data,
                borderColor: '#ff333a',
                backgroundColor: 'rgba(255, 51, 58, 0.05)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0 } },
                y: { grid: { color: '#f0f0f0' }, beginAtZero: false }
            },
            animation: { duration: 0 }
        }
    });
}

// 產生歷史資料 (模擬)
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
        while (date.getDay() === 0 || date.getDay() === 6) { date.setDate(date.getDate() + 1); }
        const dateStr = date.toISOString().split('T')[0];
        labels.push(dateStr);
        date.setDate(date.getDate() + 1);
    }
    const minLen = Math.min(labels.length, prices.length);
    fullHistoryData = { labels: labels.slice(-minLen), prices: prices.slice(-minLen) };
}

// 價量 (模擬)
function renderVolumeStats(currentPrice) {
    const buyPct = Math.floor(Math.random() * 40) + 30; 
    document.getElementById('buyPct').innerText = buyPct + '%';
    document.getElementById('sellPct').innerText = (100 - buyPct) + '%';
    document.getElementById('sentimentBar').style.width = buyPct + '%';
    document.getElementById('turnover').innerText = (Math.random() * 50 + 10).toFixed(1);
    document.getElementById('avgPrice').innerText = (currentPrice * (1 + (Math.random()-0.5)*0.01)).toFixed(2);
    document.getElementById('amplitude').innerText = (Math.random() * 2 + 0.5).toFixed(2) + '%';
    document.getElementById('tickVol').innerText = Math.floor(Math.random() * 50);
}
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
