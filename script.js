// --- JS 邏輯區 (完整版：含時間區間切換與效能優化) ---

// 1. 模擬資料庫 (增加一些預設股票)
const mockData = {
    "2330": { name: "台積電", price: 578.00, change: 5.00, pct: 0.87, volume: 32450 },
    "2454": { name: "聯發科", price: 920.00, change: -10.00, pct: -1.08, volume: 4500 },
    "2603": { name: "長榮", price: 150.50, change: 2.50, pct: 1.69, volume: 89000 },
    "2317": { name: "鴻海", price: 101.50, change: 0.50, pct: 0.50, volume: 56000 } // 擴充範例
};

// 全域變數
let kChartInstance = null;
let volChartInstance = null;
let fullHistoryData = { labels: [], prices: [] }; // 儲存生成的歷史資料

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
        // 1. 判斷搜尋哪一檔 (模擬匹配)
        let stockKey = "2330"; // 預設台積電
        if(input.includes("2454") || input.includes("聯發科")) stockKey = "2454";
        if(input.includes("2603") || input.includes("長榮")) stockKey = "2603";
        if(input.includes("2317") || input.includes("鴻海")) stockKey = "2317";

        const stock = mockData[stockKey];

        // 2. 生成該股票的 5 年歷史資料 (模擬 API 回傳)
        // 為了讓圖表看起來真實，我們以當前價格為基準往前推算
        generateMockHistory(stock.price);

        // 3. 渲染主畫面
        renderDashboard(input, stock);
        
        // 4. 重置按鈕狀態 (預設選 1M)
        document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.range-btn')[1].classList.add('active'); // 選中第二個按鈕(1M)

        dashboard.style.display = 'grid';
    }, 500);
}

// 產生模擬的長歷史資料 (5 年約 1260 個交易日)
function generateMockHistory(currentPrice) {
    const totalDays = 1260; 
    const labels = [];
    const prices = [];
    
    // 簡單的隨機漫步演算法，從過去算回來
    // 先生成一個陣列，最後一個值要是 currentPrice
    let tempPrices = [currentPrice];
    for(let i=1; i<totalDays; i++) {
        const prev = tempPrices[i-1];
        const change = (Math.random() - 0.5) * (prev * 0.03); // 3% 波動
        tempPrices.push(prev - change); // 逆推回去
    }
    // 反轉陣列，變成從過去到現在
    prices.push(...tempPrices.reverse());

    // 產生日期標籤
    let date = new Date();
    date.setDate(date.getDate() - totalDays);

    for (let i = 0; i < totalDays; i++) {
        // 跳過週末
        while (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() + 1);
        }
        const dateStr = date.toISOString().split('T')[0];
        labels.push(dateStr);
        date.setDate(date.getDate() + 1);
    }
    
    // 修正長度不一致 (因跳過週末)
    const minLen = Math.min(labels.length, prices.length);
    fullHistoryData = { 
        labels: labels.slice(-minLen), 
        prices: prices.slice(-minLen) 
    };
}

// 渲染儀表板
function renderDashboard(query, stock) {
    // 1. 更新文字資訊
    document.getElementById('stockName').innerText = `${stock.name} (${query.match(/\d+/) ? query : '2330'})`;
    document.getElementById('currentPrice').innerText = stock.price.toFixed(2);
    
    const changeEl = document.getElementById('priceChange');
    const priceEl = document.getElementById('currentPrice');

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

    // 2. 繪製圖表 (預設顯示 1M)
    updateTimeRange('1M');

    // 3. 更新其他區塊
    renderOrderBook(stock.price);
    renderChips();
    renderAIAnalysis();
    renderNews(stock.name);
}

// ★★★ 切換時間區間的核心功能 ★★★
function updateTimeRange(range, btnElement) {
    // 1. 更新按鈕樣式 UI
    if(btnElement) {
        document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }

    // 2. 決定要切多少資料
    const totalPoints = fullHistoryData.labels.length;
    let sliceCount = 22; // 預設 1M (約22交易日)

    switch(range) {
        case '5D': sliceCount = 5; break;
        case '1M': sliceCount = 22; break;
        case '6M': sliceCount = 132; break;
        case 'YTD': 
            // 計算今年過了幾天
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            const diffTime = Math.abs(new Date() - startOfYear);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            sliceCount = Math.floor(diffDays * 0.7); // 扣掉週末粗估
            break;
        case '1Y': sliceCount = 264; break;
        case '5Y': sliceCount = totalPoints; break; // 全部
        case 'MAX': sliceCount = totalPoints; break; // 全部
    }

    if (sliceCount > totalPoints) sliceCount = totalPoints;

    // 3. 切割資料 (取最後 sliceCount 筆)
    const viewLabels = fullHistoryData.labels.slice(-sliceCount);
    const viewPrices = fullHistoryData.prices.slice(-sliceCount);

    // 4. 重新繪圖
    drawKChart(viewLabels, viewPrices);
    
    // 順便重繪量能圖
    drawVolumeChart();
}

// 繪製 K 線圖 (效能優化版)
function drawKChart(labels, data) {
    const ctx = document.getElementById('kLineChart').getContext('2d');
    
    // 銷毀舊圖表防止卡頓
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
                pointRadius: 0, // ★ 關鍵：預設不顯示點，提升大量資料時的效能
                pointHoverRadius: 4, // 滑鼠碰到才顯示
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false },
                tooltip: { 
                    callbacks: { title: (items) => `日期: ${items[0].label}` }
                }
            },
            scales: {
                x: { 
                    grid: { display: false },
                    ticks: { maxTicksLimit: 6, maxRotation: 0 } // 限制 X 軸標籤數量
                },
                y: { 
                    grid: { color: '#f0f0f0' },
                    beginAtZero: false 
                }
            },
            animation: { duration: 0 } // 關閉動畫或設很短，讓切換更順暢
        }
    });
}

// 繪製量能圖
function drawVolumeChart() {
    const ctx = document.getElementById('volumeChart').getContext('2d');
    if(volChartInstance) volChartInstance.destroy();
    
    volChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['買盤', '賣盤'],
            datasets: [{
                data: [Math.floor(Math.random()*100), Math.floor(Math.random()*100)],
                backgroundColor: ['#ff333a', '#00aa00'],
                barThickness: 20
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: true } }
        }
    });
}

// 輔助函式：五檔
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

// 輔助函式：籌碼
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

// 輔助函式：AI 分析
function renderAIAnalysis() {
    const getStars = () => '★'.repeat(3 + Math.floor(Math.random()*3)) + '☆'.repeat(2 - Math.floor(Math.random()*2));
    document.getElementById('starDay').innerText = getStars();
    document.getElementById('starShort').innerText = getStars();
    document.getElementById('starLong').innerText = getStars();
}

// 輔助函式：新聞
function renderNews(name) {
    const list = document.getElementById('newsList');
    list.innerHTML = `<div class="news-item"><span class="news-title">${name} 法說會報喜，營收超乎預期</span><span class="news-time">14:00</span></div><div class="news-item"><span class="news-title">外資連續三日買超 ${name}，目標價上調</span><span class="news-time">13:30</span></div>`;
}
