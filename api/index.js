// api/index.js
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        // 1. 平行處理：同時抓報價 (quote) 和新聞 (search/news)
        const quotePromise = yahooFinance.quote(symbol);
        const newsPromise = yahooFinance.search(symbol, { newsCount: 3 }); 

        const [quote, newsResult] = await Promise.all([quotePromise, newsPromise]);

        // 2. 準備 AI 分析素材 (根據漲跌產生動態講評)
        const change = quote.regularMarketChangePercent || 0;
        const price = quote.regularMarketPrice;
        const trend = change > 0 ? "看多" : (change < 0 ? "看空" : "盤整");
        const color = change > 0 ? "red" : "green"; // 台股紅漲綠跌邏輯
        
        // 模擬三大 AI 的觀點 (這裡是用程式邏輯生成，模擬 AI 語氣)
        const aiOpinions = {
            gemini: {
                name: "Gemini 3",
                view: change > 1 ? "強勢上攻" : (change < -1 ? "弱勢探底" : "區間震盪"),
                desc: change > 0 
                    ? `技術面顯示多頭排列，KD指標黃金交叉，建議沿五日線操作。`
                    : `股價跌破短均線，短線支撐轉弱，建議觀望等待止跌訊號。`,
                score: change > 0 ? 85 : 40
            },
            gpt: {
                name: "GPT-5",
                view: "基本面分析",
                desc: `從產業數據庫檢索，該公司營收動能${change > 0 ? '強勁' : '放緩'}。市場情緒目前呈現${change > 0 ? '貪婪' : '恐慌'}狀態，機構評級維持${change > 0 ? '買進' : '中立'}。`,
                score: change > 0 ? 90 : 50
            },
            deepseek: {
                name: "DeepSeek V3.2",
                view: "籌碼大數據",
                desc: `深度掃描盤中大單，發現${change > 0 ? '主力連續吸籌' : '主力調節賣壓'}。外資與投信${change > 0 ? '同步站在買方' : '出現分歧'}，散戶指標${change > 0 ? '下降' : '上升'}。`,
                score: change > 0 ? 88 : 45
            }
        };

        // 總結
        const summary = `綜合三大模型分析：Gemini 3 與 DeepSeek V3.2 同步${trend}。${aiOpinions.gpt.desc} 建議投資人${change > 0 ? '偏多操作，設好停利' : '保守操作，嚴設停損'}。`;

        // 3. 整理新聞資料
        // yahoo-finance2 的 search 結果包含 news
        const news = newsResult.news || [];
        const formattedNews = news.map(item => ({
            title: item.title,
            link: item.link,
            publisher: item.publisher,
            time: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toLocaleTimeString() : '最新'
        }));

        // 4. 回傳完整 JSON
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
            // 新增區塊
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
