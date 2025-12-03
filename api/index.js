// api/index.js (修復新聞即時性與快取問題)
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    // ★★★ 關鍵修正 1：設定 Response Header 禁止快取 ★★★
    // 這告訴瀏覽器和 Vercel：這份資料是即時的，絕對不要存快取，每次都要重抓
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        // 設定查詢時間 (3天前)
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        
        // 1. 抓報價
        const quotePromise = yahooFinance.quote(symbol);
        
        // ★★★ 關鍵修正 2：改用 quoteSummary 抓取「個股專屬新聞」 ★★★
        // 原本的 search 只是搜尋關鍵字，quoteSummary 才是該股票頁面下的新聞
        const newsPromise = yahooFinance.quoteSummary(symbol, { modules: ["news"] });

        // 3. 抓 K 線
        const chartPromise = yahooFinance.chart(symbol, { 
            period1: threeDaysAgo, 
            interval: '5m' 
        });

        // 平行執行
        const [quote, newsResult, chartResult] = await Promise.all([quotePromise, newsPromise, chartPromise]);

        // 處理 K 線
        const chartData = (chartResult.quotes || []).filter(q => q.close && q.volume > 0);
        
        // 處理新聞 (注意：quoteSummary 的回傳結構跟 search 不太一樣)
        // newsResult.news 裡面就是新聞陣列
        const rawNews = newsResult.news || [];
        const formattedNews = rawNews
            .filter(item => item.title && item.link)
            .slice(0, 3) // 取前三則
            .map(item => ({
                title: item.title,
                link: item.link,
                publisher: item.publisher,
                // 轉換時間
                time: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '最新'
            }));

        // AI 分析邏輯 (保持不變)
        const change = quote.regularMarketChangePercent || 0;
        const trend = change > 0 ? "偏多" : (change < 0 ? "偏空" : "盤整");
        
        const aiOpinions = {
            gemini: {
                name: "Gemini 3",
                view: change > 0.5 ? "強勢上攻" : (change < -0.5 ? "弱勢探底" : "區間震盪"),
                desc: change > 0 
                    ? `實時 K 線呈現底底高型態，多方控盤力道強勁，KD 指標高檔鈍化，建議續抱。`
                    : `股價跌破短均線支撐，空方賣壓沉重，技術面轉弱，建議避開鋒芒。`,
                score: change > 0 ? 85 : 40
            },
            gpt: {
                name: "GPT-5",
                view: "基本面分析",
                desc: `檢索該產業最新動態，市場情緒${change > 0 ? '樂觀' : '保守'}。成交量${quote.regularMarketVolume > 20000 ? '顯著放大' : '溫和'}，法人籌碼動向值得關注。`,
                score: change > 0 ? 90 : 50
            },
            deepseek: {
                name: "DeepSeek V3.2",
                view: "籌碼大數據",
                desc: `高頻演算法偵測到${change > 0 ? '主力吸籌' : '大戶調節'}訊號。目前股價位於${change > 0 ? '支撐區之上' : '壓力區之下'}，乖離率${Math.abs(change) > 2 ? '過大需防修正' : '適中'}。`,
                score: change > 0 ? 88 : 45
            }
        };

        const summary = `綜合 AI 模型分析：目前趨勢${trend}。${aiOpinions.gemini.desc} 建議投資人${change > 0 ? '順勢操作' : '保守觀望'}。`;

        const result = {
            name: quote.longName || symbol,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            pct: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            high: quote.regularMarketDayHigh,
            low: quote.regularMarketDayLow,
            open: quote.regularMarketOpen,
            prevClose: quote.regularMarketPreviousClose,
            chart: chartData, 
            aiAnalysis: {
                opinions: aiOpinions,
                summary: summary
            },
            news: formattedNews
        };

        return res.status(200).json(result);

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: 'Failed to fetch data', details: error.message });
    }
}
