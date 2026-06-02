// Vercel Serverless Function: /api/analyze-url
// Безопасный учебный URL-анализатор для первичного антифрод-разбора.
// Не исполняет JavaScript, а только скачивает HTML и извлекает статические признаки.

const MAX_BYTES = 600_000;
const TIMEOUT_MS = 8000;

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
  ) return true;
  return false;
}

function extractScriptSources(html, baseUrl) {
  const out = new Set();
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      out.add(new URL(m[1], baseUrl).toString());
    } catch {
      out.add(m[1]);
    }
  }
  return Array.from(out).slice(0, 80);
}

function stripLargeWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

export default async function handler(req, res) {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return res.status(400).json({ ok: false, error: "Не передан параметр url" });
    }

    let target;
    try {
      target = new URL(rawUrl);
    } catch {
      return res.status(400).json({ ok: false, error: "Некорректный URL" });
    }

    if (!["http:", "https:"].includes(target.protocol)) {
      return res.status(400).json({ ok: false, error: "Разрешены только http/https URL" });
    }

    if (isBlockedHost(target.hostname)) {
      return res.status(400).json({ ok: false, error: "Этот host заблокирован для защиты от SSRF" });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "AntifraudAnalystAgent/1.0 educational scanner",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow"
    });

    clearTimeout(timer);

    if (!response.ok) {
      return res.status(502).json({ ok: false, error: `Сайт вернул HTTP ${response.status}` });
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    const limited = text.slice(0, MAX_BYTES);

    const scriptSources = extractScriptSources(limited, target.toString());

    const inlineScripts = [];
    const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = scriptRe.exec(limited)) !== null && inlineScripts.length < 12) {
      const body = stripLargeWhitespace(m[1] || "");
      if (body) inlineScripts.push(body.slice(0, 12000));
    }

    const joinedScripts = inlineScripts.join("\n\n").slice(0, 120000);
    const htmlSnippet = limited.slice(0, 180000);

    return res.status(200).json({
      ok: true,
      url: target.toString(),
      finalUrl: response.url,
      status: response.status,
      contentType,
      analyzedBytes: limited.length,
      truncated: text.length > MAX_BYTES,
      scriptSources,
      htmlSnippet,
      joinedScripts
    });
  } catch (err) {
    const msg = err && err.name === "AbortError" ? "Таймаут запроса" : (err.message || "Ошибка анализа URL");
    return res.status(500).json({ ok: false, error: msg });
  }
}
