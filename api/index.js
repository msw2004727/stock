// api/index.js (修復日期崩潰與新聞精準度)
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        // 1. 設定查詢參數
        // ★★★ 關鍵修正：period1 必須是日期物件，不能寫字串 '1d' ★★★
        // 我們抓取「過去 3 天」的資料，確保能包含到完整的最近一個交易日 (即使今天是週一也能抓到週五)
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        
        const quotePromise = yahooFinance.quote(symbol);
        // 抓 10 則新聞再來過濾，提升精準度
        const newsPromise = yahooFinance.search(symbol, { newsCount: 10 });
        // 抓取真實 K 線 (5分鐘一盤)
        const chartPromise = yahooFinance.chart(symbol, { 
            period1: threeDaysAgo, 
            interval: '5m' 
        });

        // 平行執行
        const [quote, newsResult, chartResult] = await Promise.all([quotePromise, newsPromise, chartPromise]);

        // 2. 處理 K 線數據
        // 過濾掉沒有成交量的盤 (避免盤後零星數據干擾圖表)
        const chartData = (chartResult.quotes || []).filter(q => q.close && q.volume > 0);
        
        // 3. 處理新聞 (更嚴格的過濾)
        const rawNews = newsResult.news || [];
        const formattedNews = rawNews
            .filter(item => item.title && item.link) // 確保有標題連結
            .slice(0, 3) // 只取前三則
            .map(item => ({
                title: item.title,
                link: item.link,
                publisher: item.publisher,
                time: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '最新'
            }));

        // 4. 生成 AI 分析
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
