// api/index.js (整合 FinMind 真實法人數據)
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    // 禁止快取，確保資料最新
    res.setHeader('Cache-Control', 'no-store, no-cache');

    try {
        // 1. 準備日期參數
        const today = new Date();
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const startDate = tenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Yahoo 使用 "2330.TW"，但 FinMind 只吃 "2330"，需移除 .TW
        const stockId = symbol.replace('.TW', '');

        // 2. 定義所有 API 請求
        // (A) Yahoo 報價
        const quotePromise = yahooFinance.quote(symbol);
        // (B) Yahoo 新聞
        const newsPromise = yahooFinance.quoteSummary(symbol, { modules: ["news"] });
        // (C) Yahoo K線 (3天)
        const chartPromise = yahooFinance.chart(symbol, { 
            period1: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), 
            interval: '5m' 
        });
        
        // (D) ★★★ 新增：FinMind 三大法人買賣超 ★★★
        // dataset: TaiwanStockInstitutionalInvestorsBuySell (個股法人買賣超)
        const finMindUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${stockId}&start_date=${startDate}`;
        const chipsPromise = fetch(finMindUrl).then(r => r.json());

        // 3. 平行執行所有請求
        const [quote, newsResult, chartResult, chipsResult] = await Promise.all([
            quotePromise, 
            newsPromise, 
            chartPromise,
            chipsPromise
        ]);

        // 4. 處理 FinMind 法人資料
        let realChips = [];
        if (chipsResult.data && chipsResult.data.length > 0) {
            // 取最後一筆 (最新交易日) 的資料
            // FinMind 回傳的是一個陣列，包含外資、投信、自營商等多筆，需篩選同一天
            const latestData = chipsResult.data.filter(d => d.date === chipsResult.data[chipsResult.data.length-1].date);
            
            // 整理格式
            let foreign = 0; // 外資
            let trust = 0;   // 投信
            let dealer = 0;  // 自營商

            latestData.forEach(item => {
                if (item.name === 'Foreign_Investor') foreign += item.buy - item.sell;
                if (item.name === 'Investment_Trust') trust += item.buy - item.sell;
                if (item.name === 'Dealer' || item.name === 'Dealer_Self' || item.name === 'Dealer_Hedging') dealer += item.buy - item.sell;
            });
            
            // 轉換成張數 (FinMind 單位是股，除以 1000)
            realChips = [
                { name: '外資', val: Math.floor(foreign / 1000) },
                { name: '投信', val: Math.floor(trust / 1000) },
                { name: '自營商', val: Math.floor(dealer / 1000) },
                // 主力目前 FinMind 免費版較難取得精準定義，暫時顯示合計或移除
                { name: '合計', val: Math.floor((foreign + trust + dealer) / 1000) }
            ];
        } else {
            // 如果抓不到 (例如美股或ETF)，回傳空陣列，前端顯示 --
            realChips = [
                { name: '外資', val: null },
                { name: '投信', val: null },
                { name: '自營商', val: null },
                { name: '合計', val: null }
            ];
        }

        // 5. 處理其他資料 (K線、新聞)
        const chartData = (chartResult.quotes || []).filter(q => q.close && q.volume > 0);
        
        const rawNews = newsResult.news || [];
        const formattedNews = rawNews.slice(0, 3).map(item => ({
            title: item.title,
            link: item.link,
            publisher: item.publisher,
            time: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '最新'
        }));

        const change = quote.regularMarketChangePercent || 0;
        const trend = change > 0 ? "偏多" : (change < 0 ? "偏空" : "盤整");
        
        // 簡單的 AI 邏輯 (此處維持不變)
        const aiOpinions = {
            gemini: {
                name: "Gemini 3",
                view: change > 0.5 ? "強勢上攻" : (change < -0.5 ? "弱勢探底" : "區間震盪"),
                desc: change > 0 ? "多方力道強勁，建議順勢操作。" : "賣壓沉重，建議保守觀望。",
                score: change > 0 ? 85 : 40
            },
            gpt: {
                name: "GPT-5",
                view: "基本面分析",
                desc: `市場情緒${change > 0 ? '樂觀' : '保守'}，成交量${quote.regularMarketVolume > 20000 ? '放大' : '正常'}。`,
                score: change > 0 ? 90 : 50
            },
            deepseek: {
                name: "DeepSeek V3.2",
                view: "技術籌碼",
                desc: `股價位於${change > 0 ? '支撐' : '壓力'}區，法人動向${realChips[0].val > 0 ? '偏多' : '偏空'}。`,
                score: change > 0 ? 88 : 45
            }
        };

        const result = {
            name: quote.longName || symbol,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            pct: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            chart: chartData, 
            aiAnalysis: {
                opinions: aiOpinions,
                summary: `目前趨勢${trend}，外資今日${realChips[0].val > 0 ? '買超' : '賣超'} ${Math.abs(realChips[0].val || 0)} 張。`
            },
            news: formattedNews,
            chips: realChips // ★ 將真實籌碼傳給前端
        };

        return res.status(200).json(result);

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: 'Failed', details: error.message });
    }
}
