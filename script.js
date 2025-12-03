// --- JS 邏輯區 (真實 K 線數據版) ---

let kChartInstance = null;
let fullHistoryData = { labels: [], prices: [] };
let intradayRealData = { labels: [], prices: [] }; // ★ 新增：存真實當日數據

// 搜尋功能入口
async function searchStock() {
    const input = document.getElementById('stockInput').value.trim();
    const dashboard = document.getElementById('dashboard');
    
    if(!input) {
        alert("請輸入股票代號或名稱");
        return;
    }

    document.getElementById('stockName').innerText = "AI 數據連線中...";
    dashboard.style.display = 'grid';

    try {
        let querySymbol = input;
        if (/^\d+$/.test(input)) {
            querySymbol = input + ".TW";
        } else {
            // 簡易對應，實際建議後端做 mapping
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

        // 1. 處理真實 K 線資料 (從後端來的 5分K)
        if (stockData.chart && stockData.chart.length > 0) {
            const chartLabels = [];
            const chartPrices = [];
            
            stockData.chart.forEach(point => {
                // 轉換時間戳記為 HH:mm
                const date = new Date(point.date);
                const timeStr = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                // 只取有交易的 close 價格
                if(point.close) {
                    chartLabels.push(timeStr);
                    chartPrices.push(point.close);
                }
            });
            intradayRealData = { labels: chartLabels, prices: chartPrices };
        }

        // 2. 生成長線歷史資料 (這部分因為免費 API 限制，暫時維持模擬，若要全真實需後端加抓歷史)
        generateMockHistory(stockData.price);
        
        // 3. 渲染畫面
        renderDashboard(input, stockData);
        
        // 4. 預設顯示 1D (當日)
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
    document.getElementById('dataDate').innerText = new Date().toLocaleString('zh-TW');

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

    // 更新 AI 卡片
    if (stock.aiAnalysis && stock.aiAnalysis.opinions) {
        const ai = stock.aiAnalysis.opinions;
        updateAICard('gemini', ai.gemini);
        updateAICard('gpt', ai.gpt);
        updateAICard('deepseek', ai.deepseek);
        document.getElementById('aiSummaryText').innerText = stock.aiAnalysis.summary;
    }

    // ★★★ 更新新聞 (使用後端過濾後的精準新聞) ★★★
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

// 切換時間區間 (含 1D 真實邏輯)
function updateTimeRange(range, btnElement) {
    if(btnElement) {
        document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    let labels, data;

    if (range === '1D') {
        // ★★★ 使用從後端抓回來的真實數據 ★★★
        labels = intradayRealData.labels;
        data = intradayRealData.prices;
        
        // 防呆：如果剛開盤沒數據，顯示空圖表或提示
        if(labels.length === 0) {
            labels = ["09:00", "13:30"];
            data = [null, null];
        }
    } else {
        // 歷史資料 (目前仍為模擬，可後續擴充)
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
                pointRadius: 0, // 隱藏點
                pointHoverRadius: 4,
                fill: true,
                tension: 0.1 // 稍微一點平滑，讓鋸齒看起來更自然
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
                    ticks: { 
                        maxTicksLimit: 6, 
                        maxRotation: 0,
                        // 如果是 1D，確保標籤不會太擠
                        callback: function(val, index) {
                            return this.getLabelForValue(val);
                        }
                    } 
                },
                y: { grid: { color: '#f0f0f0' }, beginAtZero: false }
            },
            animation: { duration: 0 }
        }
    });
}

// 產生模擬歷史資料 (長天期用)
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
// 五檔 (模擬)
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
// 籌碼 (模擬)
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
