// api/index.js
// 這是運行在 Vercel 雲端的後端程式

import yahooFinance from 'yahoo-finance2';
// 如果你有 OpenAI Key，可以取消下面的註解並設定
// import OpenAI from 'openai';

export default async function handler(req, res) {
    // 1. 取得前端傳來的股票代號 (例如 ?symbol=2330.TW)
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: 'Missing symbol parameter' });
    }

    try {
        // 2. 使用 yahoo-finance2 抓取即時報價
        // 台股代號在 Yahoo 需要加上 .TW (例如 2330.TW)
        const quote = await yahooFinance.quote(symbol);
        
        // 抓取歷史資料 (用來畫K線) - 抓最近 60 天
        const queryOptions = { period1: '2023-01-01', interval: '1d' }; // 日期可動態調整
        // 這裡簡化，先只回傳 quote 即時資料，歷史資料邏輯較多建議分開寫或簡單模擬

        // 3. 整理資料回傳給前端
        // 我們將資料格式整理成跟原本 mockData 一樣，這樣前端改動最小
        const result = {
            name: quote.longName || symbol,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            pct: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            // 額外資訊
            high: quote.regularMarketDayHigh,
            low: quote.regularMarketDayLow,
            open: quote.regularMarketOpen,
            prevClose: quote.regularMarketPreviousClose
        };

        // 4. (進階) AI 分析部分
        // 如果你有設定 OpenAI API Key，可以在這裡呼叫 GPT-4
        // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        // const analysis = await openai.chat.completions.create({ ... });
        // result.aiAnalysis = analysis.choices[0].message.content;

        // 回傳 JSON
        return res.status(200).json(result);

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ 
            error: 'Failed to fetch data', 
            details: error.message 
        });
    }
}
