// api/index.js (Vercel Serverless Function)
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        // 1. 同時抓取報價與新聞
        const quotePromise = yahooFinance.quote(symbol);
        const newsPromise = yahooFinance.search(symbol, { newsCount: 3 }); 

        const [quote, newsResult] = await Promise.all([quotePromise, newsPromise]);

        // 2. 根據股價數據，生成三大 AI 專家的模擬觀點
        const change = quote.regularMarketChangePercent || 0;
        const trend = change > 0 ? "看多" : (change < 0 ? "看空" : "盤整");
        
        const aiOpinions = {
            gemini: {
                name: "Gemini 3",
                view: change > 0.5 ? "強勢上攻" : (change < -0.5 ? "弱勢探底" : "區間震盪"),
                desc: change > 0 
                    ? `技術面均線呈多頭排列，KD指標高檔鈍化，建議沿五日線操作，適合積極型投資人。`
                    : `股價跌破短均線支撐，技術面轉弱，建議保守觀望，等待底部訊號浮現。`,
                score: change > 0 ? 85 : 40
            },
            gpt: {
                name: "GPT-5",
                view: "基本面分析",
                desc: `檢索該公司近期財報與產業數據，營收動能${change > 0 ? '穩健向上' : '略顯疲軟'}。市場情緒目前${change > 0 ? '樂觀' : '保守'}，機構評級維持${change > 0 ? '買進' : '持有'}。`,
                score: change > 0 ? 90 : 50
            },
            deepseek: {
                name: "DeepSeek V3.2",
                view: "籌碼大數據",
                desc: `深度掃描盤中大單，發現${change > 0 ? '主力連續吸籌' : '主力調節賣壓'}。外資與投信${change > 0 ? '同步站在買方' : '出現分歧'}，籌碼集中度${change > 0 ? '上升' : '下降'}。`,
                score: change > 0 ? 88 : 45
            }
        };

        const summary = `綜合 Gemini 3 與 DeepSeek V3.2 分析，目前趨勢${trend}。${aiOpinions.gpt.desc} 建議投資人${change > 0 ? '偏多操作，設好停利' : '嚴設停損，保留現金'}。`;

        // 3. 處理新聞
        const news = newsResult.news || [];
        const formattedNews = news.map(item => ({
            title: item.title,
            link: item.link,
            publisher: item.publisher,
            time: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toLocaleTimeString() : '最新'
        }));

        // 4. 回傳整合資料
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
