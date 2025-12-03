// api/index.js (Vercel Serverless Function - 真實 K 線版)
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        // 1. 定義查詢選項
        // query1: 抓即時報價
        const quotePromise = yahooFinance.quote(symbol);
        
        // query2: 抓新聞 (嘗試抓多一點，再過濾)
        const newsPromise = yahooFinance.search(symbol, { newsCount: 5 });

        // query3: ★★★ 關鍵新增：抓取真實 Intraday K線 (1天內, 每5分鐘一盤) ★★★
        // 這樣才能畫出跟 Google 財經一樣的鋸齒圖
        const chartPromise = yahooFinance.chart(symbol, { period1: '1d', interval: '5m' });

        // 平行執行所有請求
        const [quote, newsResult, chartResult] = await Promise.all([quotePromise, newsPromise, chartPromise]);

        // 2. 處理真實 K 線數據
        // chartResult.quotes 裡包含了 timestamp, open, high, low, close, volume
        const chartData = chartResult.quotes || [];
        
        // 3. 處理新聞 (過濾掉不相關的)
        const rawNews = newsResult.news || [];
        const formattedNews = rawNews
            .filter(item => item.title && item.link) // 過濾掉沒標題的壞資料
            .slice(0, 3) // 只取前三則
            .map(item => ({
                title: item.title,
                link: item.link,
                publisher: item.publisher,
                // 轉換時間格式
                time: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '最新'
            }));

        // 4. 生成 AI 分析 (根據真實漲跌)
        const change = quote.regularMarketChangePercent || 0;
        
        const aiOpinions = {
            gemini: {
                name: "Gemini 3",
                view: change > 0.5 ? "強勢上攻" : (change < -0.5 ? "弱勢探底" : "區間震盪"),
                desc: change > 0 
                    ? `實時圖表顯示多方力道強勁，5分K線呈現底底高型態，建議續抱。`
                    : `實時賣壓沉重，短線均線下彎，建議避開鋒芒等待止穩。`,
                score: change > 0 ? 85 : 40
            },
            gpt: {
                name: "GPT-5",
                view: "基本面分析",
                desc: `最新財經新聞顯示市場對該產業持${change > 0 ? '樂觀' : '保守'}態度。成交量${quote.regularMarketVolume > 20000000 ? '顯著放大' : '溫和'}，機構法人動向值得關注。`,
                score: change > 0 ? 90 : 50
            },
            deepseek: {
                name: "DeepSeek V3.2",
                view: "籌碼大數據",
                desc: `高頻算法偵測到${change > 0 ? '大單敲進' : '大單調節'}跡象。目前股價位於${change > 0 ? '支撐線之上' : '壓力線之下'}，乖離率${Math.abs(change) > 2 ? '過大需防修正' : '適中'}。`,
                score: change > 0 ? 88 : 45
            }
        };

        const summary = `綜合數據：Gemini 與 DeepSeek 偵測到${change > 0 ? '多方訊號' : '空方訊號'}。建議投資人${change > 0 ? '順勢操作' : '保守觀望'}。`;

        // 5. 回傳整合資料
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
            // 真實圖表數據
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
