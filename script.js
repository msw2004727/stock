// script.js

// 股票代號與名稱的模擬資料 (用於模糊搜尋)
const STOCK_LIST = [
    { code: '2330', name: '台積電' },
    { code: '2454', name: '聯發科' },
    { code: '2317', name: '鴻海' },
    { code: '0050', name: '元大台灣50' }
];


// --- 核心函數：模擬資料抓取與渲染 ---

/**
 * 主要執行函數：模擬抓取股票資料並更新介面
 */
function fetchStockData() {
    const input = document.getElementById('stock-input').value.trim();
    if (!input) {
        alert('請輸入股票號碼或名稱！');
        return;
    }

    // 模擬模糊搜尋 (根據代號或名稱)
    const stock = STOCK_LIST.find(s => s.code === input || s.name.includes(input));

    if (!stock) {
        alert(`找不到與 "${input}" 相關的股票。`);
        // 清空舊資料
        clearInterface();
        return;
    }

    // 1. 模擬資料抓取
    const mockData = generateMockData(stock);

    // 2. 渲染各區塊
    renderLegalEntityData(mockData.legalEntity);
    renderOrderBook(mockData.orderBook);
    renderVolumeBar(mockData.volumeBar);
    renderNews(mockData.news);
    // 3. 執行 AI 分析並渲染
    runAIAnalysis(mockData.aiInput);

    // 提示使用者
    console.log(`已成功載入 ${stock.code} ${stock.name} 的模擬資料。`);
    // 在介面頂部顯示當前分析的股票
    document.querySelector('.header h1').innerHTML = `🤖 AI 台股分析儀 - ${stock.name} (${stock.code})`;

    // K 線圖只是佔位符，實際需要 ECharts, D3.js 或 TradingView 庫來繪製
    document.getElementById('kline-chart').innerHTML = `<p>【${stock.name}】的 K 線圖已模擬載入。<br>實際開發請整合圖表函式庫。</p>`;
}

/**
 * 清空介面資料 (當查詢失敗時)
 */
function clearInterface() {
    document.getElementById('legal-entity-table').getElementsByTagName('tbody')[0].innerHTML = '';
    document.getElementById('ai-confidence').innerHTML = '';
    document.getElementById('ai-strategy-text').innerHTML = '';
    document.getElementById('order-book').innerHTML = '';
    document.getElementById('volume-bar').innerHTML = '';
    document.getElementById('news-list').innerHTML = '';
    document.getElementById('legal-entity-date').textContent = '資料日期: --/--/--';
    document.getElementById('kline-chart').innerHTML = `<p>K 線圖模擬顯示區域</p>`;
    document.querySelector('.header h1').innerHTML = '🤖 AI 台股分析儀';
}


// --- 渲染函數 ---

/**
 * 渲染三大法人/主力籌碼數據
 */
function renderLegalEntityData(data) {
    const tbody = document.getElementById('legal-entity-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = ''; // 清空舊資料
    document.getElementById('legal-entity-date').textContent = `資料日期: ${data.date}`;

    data.entities.forEach(item => {
        const netValue = item.buy - item.sell;
        const netClass = netValue > 0 ? 'positive' : (netValue < 0 ? 'negative' : '');
        
        const row = tbody.insertRow();
        row.insertCell().textContent = item.name;
        row.insertCell().textContent = item.buy.toLocaleString();
        row.insertCell().textContent = item.sell.toLocaleString();
        row.insertCell().innerHTML = `<span class="${netClass}">${netValue.toLocaleString()}</span>`;
    });
}

/**
 * 渲染五檔買賣數值
 */
function renderOrderBook(data) {
    const orderBookDiv = document.getElementById('order-book');
    orderBookDiv.innerHTML = '<h4>賣價 (Ask)</h4>'; // 賣價在上方

    // 賣價 (Ask) - 綠/藍色
    data.ask.slice().reverse().forEach(item => {
        orderBookDiv.innerHTML += `
            <div class="order-row">
                <span class="ask-price">${item.price.toFixed(2)}</span>
                <span>${item.volume.toLocaleString()}</span>
            </div>
        `;
    });

    orderBookDiv.innerHTML += '<hr style="margin: 10px 0; border-color: #eee;">';
    orderBookDiv.innerHTML += '<h4>買價 (Bid)</h4>'; // 買價在下方

    // 買價 (Bid) - 紅色
    data.bid.forEach(item => {
        orderBookDiv.innerHTML += `
            <div class="order-row">
                <span class="bid-price">${item.price.toFixed(2)}</span>
                <span>${item.volume.toLocaleString()}</span>
            </div>
        `;
    });
}

/**
 * 渲染價量計量條
 */
function renderVolumeBar(data) {
    const volumeBarDiv = document.getElementById('volume-bar');
    volumeBarDiv.innerHTML = '';

    const totalVolume = data.buyVolume + data.sellVolume;
    const buyPercent = (data.buyVolume / totalVolume) * 100;
    const sellPercent = (data.sellVolume / totalVolume) * 100;

    volumeBarDiv.innerHTML = `
        <div class="buy-volume-bar" style="width: ${buyPercent}%;">買量: ${data.buyVolume.toLocaleString()}</div>
        <div class="sell-volume-bar" style="width: ${sellPercent}%;">賣量: ${data.sellVolume.toLocaleString()}</div>
    `;
}

/**
 * 渲染最新三則相關新聞
 */
function renderNews(data) {
    const newsListDiv = document.getElementById('news-list');
    newsListDiv.innerHTML = '';

    data.forEach(news => {
        newsListDiv.innerHTML += `
            <div class="news-item">
                <a href="${news.link}" target="_blank">${news.title}</a>
                <small>${news.source} | ${news.time}</small>
            </div>
        `;
    });
}


// --- AI 分析模組 (重點擴充位置) ---

/**
 * 產生星星評級的 HTML
 */
function getStarHtml(rating) {
    const fullStar = '★';
    const emptyStar = '☆';
    const fullStars = fullStar.repeat(rating);
    const emptyStars = emptyStar.repeat(5 - rating);
    return `<span class="confidence-stars">${fullStars}${emptyStars}</span>`;
}

/**
 * 執行 AI 分析邏輯並渲染結果
 * * @param {object} inputData - 包含籌碼、技術指標等資料
 */
function runAIAnalysis(inputData) {
    // 【AI 核心策略邏輯】
    // 這是一個簡單的、基於模擬數據的判斷邏輯
    // 實際開發中，這裡會替換成呼叫後端機器學習模型或複雜的策略演算。

    // 1. 計算當沖 (Day Trade) 信心指數: 主要看價量 (買賣量差異) 和五檔數據
    const dayTradeScore = Math.floor(Math.random() * 3) + 3; // 3~5星

    // 2. 計算短線 (Short Term) 信心指數: 主要看籌碼 (外資/投信淨買賣超)
    const legalNet = inputData.legalEntity.entities[0].net + inputData.legalEntity.entities[1].net; // 外資+投信淨額
    let shortTermScore = 3; // 預設 3
    if (legalNet > 5000) shortTermScore = 5;
    else if (legalNet > 1000) shortTermScore = 4;
    else if (legalNet < -5000) shortTermScore = 2;
    else if (legalNet < -1000) shortTermScore = 1;

    // 3. 計算長線 (Long Term) 信心指數: 主要看新聞情緒 (假設新聞都是正面)
    const longTermScore = 4;

    const confidenceHtml = `
        <p><strong>當沖 (Day Trade):</strong> ${getStarHtml(dayTradeScore)}</p>
        <p><strong>短線 (Short Term):</strong> ${getStarHtml(shortTermScore)}</p>
        <p><strong>長線 (Long Term):</strong> ${getStarHtml(longTermScore)}</p>
    `;
    document.getElementById('ai-confidence').innerHTML = confidenceHtml;


    // 策略建議 (文字描述)
    const strategyText = `
        <p class="strategy-title">當沖策略：</p>
        <p>日內買賣力道強勁，建議關注盤中大量買單出現時機，短暫多頭操作，目標價差 1.5%。</p>
        <p class="strategy-title">短線策略：</p>
        <p>外資與投信近五日呈現淨買超，籌碼面偏多，適合持股 3-5 天，留意關鍵價位 ${inputData.price + 2} 元。</p>
        <p class="strategy-title">長線策略：</p>
        <p>新聞面無重大負面消息，基本面穩固，可做為核心部位配置，逢低 ${inputData.price - 5} 元可加碼。</p>
    `;
    document.getElementById('ai-strategy-text').innerHTML = strategyText;
}

// --- 數據模擬器 (Mock Data Generator) ---

/**
 * 根據股票產生模擬數據
 */
function generateMockData(stock) {
    const today = new Date().toISOString().split('T')[0];
    const latestPrice = Math.floor(Math.random() * 50) + 150; // 模擬最新價

    return {
        // --- 籌碼分析 ---
        legalEntity: {
            date: today,
            entities: [
                { name: '外資', buy: Math.floor(Math.random() * 15000) + 5000, sell: Math.floor(Math.random() * 15000) + 5000, net: Math.floor(Math.random() * 10000) - 5000 },
                { name: '投信', buy: Math.floor(Math.random() * 5000) + 1000, sell: Math.floor(Math.random() * 5000) + 1000, net: Math.floor(Math.random() * 3000) - 1500 },
                { name: '自營商', buy: Math.floor(Math.random() * 3000) + 500, sell: Math.floor(Math.random() * 3000) + 500, net: Math.floor(Math.random() * 1000) - 500 },
                { name: '主力', buy: Math.floor(Math.random() * 20000) + 10000, sell: Math.floor(Math.random() * 20000) + 10000, net: Math.floor(Math.random() * 8000) - 4000 },
            ]
        },

        // --- 五檔買賣數值 ---
        orderBook: {
            ask: [ // 賣價 (由高到低)
                { price: latestPrice + 0.5, volume: Math.floor(Math.random() * 50) + 10 },
                { price: latestPrice + 0.4, volume: Math.floor(Math.random() * 60) + 10 },
                { price: latestPrice + 0.3, volume: Math.floor(Math.random() * 80) + 10 },
                { price: latestPrice + 0.2, volume: Math.floor(Math.random() * 100) + 10 },
                { price: latestPrice + 0.1, volume: Math.floor(Math.random() * 150) + 10 },
            ].sort((a, b) => b.price - a.price), // 確保由高到低

            bid: [ // 買價 (由低到高)
                { price: latestPrice - 0.1, volume: Math.floor(Math.random() * 200) + 10 },
                { price: latestPrice - 0.2, volume: Math.floor(Math.random() * 120) + 10 },
                { price: latestPrice - 0.3, volume: Math.floor(Math.random() * 90) + 10 },
                { price: latestPrice - 0.4, volume: Math.floor(Math.random() * 70) + 10 },
                { price: latestPrice - 0.5, volume: Math.floor(Math.random() * 40) + 10 },
            ].sort((a, b) => b.price - a.price) // 確保由高到低
        },

        // --- 價量 (計量條) ---
        volumeBar: {
            buyVolume: Math.floor(Math.random() * 50000) + 10000,
            sellVolume: Math.floor(Math.random() * 50000) + 10000
        },

        // --- 最新三則相關新聞 ---
        news: [
            { title: `${stock.name} Q3 財報優於預期，股價開盤跳空大漲`, link: '#', source: '經濟日報', time: '1小時前' },
            { title: '市場傳言：摩根士丹利看好 AI 需求，調升目標價至 950 元', link: '#', source: '工商時報', time: '3小時前' },
            { title: `${stock.code} 供應鏈傳出明年訂單滿載，有望再創新高`, link: '#', source: '鉅亨網', time: '昨日' }
        ],

        // --- 傳遞給 AI 分析器的資料 (未來會是實時數據) ---
        aiInput: {
            price: latestPrice,
            legalEntity: {
                // 這裡只傳遞淨額，方便 AI 判斷
                entities: [
                    { name: '外資', net: Math.floor(Math.random() * 15000) - 7500 },
                    { name: '投信', net: Math.floor(Math.random() * 5000) - 2500 }
                ]
            }
        }
    };
}


// --- 啟動與事件綁定 ---
document.addEventListener('DOMContentLoaded', () => {
    // 綁定 Enter 鍵事件
    document.getElementById('stock-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            fetchStockData();
        }
    });

    // 頁面載入時先載入一個預設股票 (例如 2330 台積電)
    document.getElementById('stock-input').value = '2330';
    fetchStockData();
});
