// api/index.js (穩定容錯版：防止單一資料源失敗導致崩潰)
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    // 禁止快取
    res.setHeader('Cache-Control', 'no-store, no-cache');

    try {
        const today = new Date();
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const startDate = tenDaysAgo.toISOString().split('T')[0]; 
        
        // 移除 .TW 供 FinMind 使用
        const stockId = symbol.replace('.TW', '');

        // ★★★ 關鍵修改：將每個請求獨立包裝，避免連坐法 ★★★

        // 1. 核心報價 (這是最重要的，如果這個失敗，就真的該報錯)
        const quotePromise = yahooFinance.quote(symbol);

        // 2. 新聞 (如果失敗，回傳空陣列，不要讓程式崩潰)
        const newsPromise = yahooFinance.quoteSummary(symbol, { modules: ["news"] })
            .catch(err => {
                console.error("News API Failed:", err.message);
                return { news: [] }; // 回傳空資料當作備案
            });

        // 3. K 線 (如果失敗，回傳空陣列)
        const chartPromise = yahooFinance.chart(symbol, { 
            period1: threeDaysAgo, 
            interval: '5m' 
        }).catch(err => {
            console.error("Chart API Failed:", err.message);
            return { quotes: [] }; 
        });
        
        // 4. FinMind 籌碼 (最容易失敗的部分，加強保護)
        const finMindUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${stockId}&start_date=${startDate}`;
        const chipsPromise = fetch(finMindUrl)
            .then(r => {
                if (!r.ok) throw new Error(`FinMind Status: ${r.status}`);
                return r.json();
            })
            .catch(err => {
                console.error("FinMind API Failed:", err.message);
                return { data: [] }; // 回傳空資料
            });

        // 平行執行 (現在即使配菜失敗，主餐也能上桌)
        const [quote, newsResult, chartResult, chipsResult] = await Promise.all([
            quotePromise, 
            newsPromise, 
            chartPromise,
            chipsPromise
        ]);

        // --- 以下資料處理邏輯保持不變 ---

        // 處理 FinMind 法人資料
        let realChips = [];
        if (chipsResult.data && chipsResult.data.length > 0) {
            const latestData = chipsResult.data.filter(d => d.date === chipsResult.data[chipsResult.data.length-1].date);
            
            let foreign = 0;
            let trust = 0;
            let dealer = 0;

            latestData.forEach(item => {
                if (item.name === 'Foreign_Investor') foreign += item.buy - item.sell;
                if (item.name === 'Investment_Trust') trust += item.buy - item.sell;
                if (item.name === 'Dealer' || item.name === 'Dealer_Self' || item.name === 'Dealer_Hedging') dealer += item.buy - item.sell;
            });
            
            realChips = [
                { name: '外資', val: Math.floor(foreign / 1000) },
                { name: '投信', val: Math.floor(trust / 1000) },
                { name: '自營商', val: Math.floor(dealer / 1000) },
                { name: '合計', val: Math.floor((foreign + trust + dealer) / 1000) }
            ];
        } else {
            // 如果 FinMind 失敗，這裡會執行，前端會顯示 --
            realChips = [
                { name: '外資', val: null },
                { name: '投信', val: null },
                { name: '自營商', val: null },
                { name: '合計', val: null }
            ];
        }

        // 處理 K 線與新聞
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
                desc: `股價位於${change > 0 ? '支撐' : '壓力'}區，法人動向${realChips[0].val !== null ? (realChips[0].val > 0 ? '偏多' : '偏空') : '不明'}。`,
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
                summary: `目前趨勢${trend}，${realChips[0].val !== null ? `外資今日${realChips[0].val > 0 ? '買超' : '賣超'} ${Math.abs(realChips[0].val)} 張` : '法人數據暫時無法取得'}。`
            },
            news: formattedNews,
            chips: realChips
        };

        return res.status(200).json(result);

    } catch (error) {
        console.error("API Critical Error:", error);
        // 只有在最核心的「股價」都抓不到時，才會回傳錯誤給前端
        return res.status(500).json({ error: 'Failed', details: error.message });
    }
}
