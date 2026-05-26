import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

const POSITIVE_KEYWORDS = [
  'profit', 'growth', 'surge', 'rally', 'upgrade', 'bullish', 'gain',
  'rise', 'rises', 'high', 'beat', 'record', 'strong', 'buy', 'outperform',
  'positive', 'bonus', 'dividend', 'expansion', 'launch', 'deal', 'order',
  'revenue', 'earnings', 'up', 'jumps', 'soars', 'climbs', 'recover',
  'boost', 'approve', 'win', 'success', 'breakout', 'target', 'recommend',
];

const NEGATIVE_KEYWORDS = [
  'loss', 'decline', 'fall', 'falls', 'drop', 'crash', 'bearish',
  'downgrade', 'sell', 'weak', 'miss', 'negative', 'warning', 'risk',
  'fraud', 'debt', 'fine', 'penalty', 'ban', 'probe', 'investigation',
  'default', 'lawsuit', 'slump', 'cut', 'slash', 'down', 'low',
  'concern', 'fear', 'trouble', 'plunge', 'tank', 'worst', 'caution',
];

function analyzeSentiment(title: string): 'positive' | 'negative' | 'neutral' {
  const lower = title.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;

  for (const word of POSITIVE_KEYWORDS) {
    if (lower.includes(word)) positiveScore++;
  }
  for (const word of NEGATIVE_KEYWORDS) {
    if (lower.includes(word)) negativeScore++;
  }

  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

function parseRSSItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || '';
    const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || '';
    const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || '';
    const source = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() || '';

    // Clean HTML entities
    const cleanTitle = title
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, '');

    if (cleanTitle) {
      items.push({
        title: cleanTitle,
        link,
        source: source || 'Google News',
        publishedAt: pubDate,
        sentiment: analyzeSentiment(cleanTitle),
      });
    }
  }

  return items;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = decodeURIComponent(params.symbol);

  try {
    // Fetch news from Google News RSS for the stock symbol
    const query = encodeURIComponent(`${symbol} NSE stock`);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    const response = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 900 }, // Cache for 15 minutes
    });

    if (!response.ok) {
      return NextResponse.json({
        success: true,
        data: { symbol, news: [] },
      });
    }

    const xml = await response.text();
    const news = parseRSSItems(xml)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: { symbol, news },
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: { symbol, news: [] },
    });
  }
}
