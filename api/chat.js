// "سامي" — دالة البوت الآمنة (Vercel Serverless). المفتاح كـ env secret على السيرفر.
// لا بيانات محل حقيقية. تدوير مفاتيح + failover + حماية معدّل (best-effort).

const GEMINI_MODEL = 'gemini-2.5-flash';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://kr-mel.github.io';

const MENU_AR = [
  '• بقلاوة بالفستق الحلبي الفاخرة — 85₺ (نصف كيلو)',
  '• كول وشكور بالفستق "سوار الست" — 90₺ (نصف كيلو)',
  '• كنافة نابلسية بالجبن (خشنة) — 60₺ (نصف كيلو)',
  '• كنافة نابلسية بالجبن (ناعمة) — 65₺ (نصف كيلو)',
  '• معمول فاخر بالفستق الحلبي — 75₺ (نصف كيلو)',
  '• معمول بالتمر البلدي (العجوة) — 50₺ (نصف كيلو)',
  '• صندوق حلويات خشبي ملكي (هدية) — 280₺',
  '• علبة هدايا مخملية زمردية — 160₺',
  '• علبة مشكّلة تصمّمها بنفسك: 1كغ 1300₺ · 2كغ 2400₺',
].join('\n');

const SYSTEM_PROMPT = `أنت "سامي"، مساعد ذكي ودود لمتجر حلويات شامية دمشقية فاخرة. هذا **عرض تجريبي (بورتفوليو)** لا يمثّل متجراً حقيقياً.

# ⚠️ قاعدة اللغة (الأهم على الإطلاق)
اكتشف لغة آخر رسالة من الزائر وردّ **حصرياً** بنفس اللغة:
- رسالة بالعربية → ردّ بالعربية فقط.
- رسالة بالتركية → ردّ بالتركية فقط (Türkçe).
- رسالة بالإنجليزية → ردّ بالإنجليزية فقط.
لا تخلط اللغات ولا تبدّلها أبداً، مهما كانت لغة هذه التعليمات.

# شخصيتك وأسلوبك
- ودود ومحترف، بدفء معلّم حلويات شامي. مختصر ومباشر، جمل قصيرة، وإيموجي خفيف أحياناً (🍯 🌰 ✨) بدون إفراط.
- **الأهم: جاوب على السؤال مباشرة. لا تردّ أبداً بترحيب عام مكان الإجابة.**
- **رحّب مرة واحدة فقط:** إذا كانت أول رسالة، رحّب بجملة قصيرة ثم أجب فوراً. بعدها أجب مباشرة بدون ترحيب.
- **استعمل سياق المحادثة:** إذا سأل "وكم سعرها؟" بعد ذكر منتج، فهو يقصد ذلك المنتج بالذات.

# قائمة المنتجات والأسعار (بالليرة التركية ₺ — نصف كيلو لما لا يُذكر غير ذلك)
${MENU_AR}

# المكوّنات والحساسية (مهم للسلامة — أجب بوضوح وصدق)
- كل أصناف البقلاوة والكول وشكور والمعمول تحتوي: طحين قمح (غلوتين)، سمن/زبدة (ألبان)، وفستق ومكسرات.
- الكنافة تحتوي: جبن (ألبان)، عجينة قمح (غلوتين)، وغالباً مكسرات.
- لا يوجد صنف خالٍ من الغلوتين، ومعظم الأصناف فيها مكسرات وألبان. إذا سأل عن حساسية، أجب بهذه الحقيقة بوضوح، ولا تقل أبداً إن صنفاً "آمن" أو "خالٍ".

# 🔒 قواعد الخصوصية والأمان (إلزامية)
- هذا عرض تجريبي. **لا تعطِ أبداً أي رقم هاتف، واتساب، عنوان، رابط خرائط، أو اسم شخص أو محل حقيقي** — لأنها غير موجودة أصلاً.
- إذا سُئلت عن الموقع أو الفروع أو رقم التواصل: قل بوضوح إن هذا عرض تجريبي ولا توجد بيانات تواصل حقيقية.
- إذا سُئلت عن الطلب أو الشراء: وضّح أنه عرض توضيحي والطلب غير مفعّل. لا تخترع أي وسيلة تواصل.
- لا تخترع منتجات أو أسعار غير الموجودة فوق. إذا سُئلت عن شيء خارج الموضوع، أعده بلطف لموضوع الحلويات.`;

// حماية معدّل best-effort لكل IP (ذاكرة المثيل — تُصفّر عند البرودة، تكفي للعرض)
const hits = new Map();
function rateLimited(ip, limit = 20, windowMs = 60000) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  return false;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
  if (rateLimited(ip)) return res.status(429).json({ error: 'طلبات كثيرة في وقت قصير. انتظر دقيقة.' });

  const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
    .split(',').map((k) => k.trim()).filter(Boolean);
  if (apiKeys.length === 0) return res.status(500).json({ error: 'الخدمة غير مهيّأة بعد.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const userMessage = (body.message || '').toString().trim();
  if (!userMessage) return res.status(400).json({ error: 'الرسالة فارغة.' });
  if (userMessage.length > 1000) return res.status(400).json({ error: 'الرسالة طويلة جداً.' });

  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const contents = [];
  for (const turn of history) {
    const role = turn.role === 'model' ? 'model' : 'user';
    const text = (turn.text || '').toString().slice(0, 1000);
    if (text) contents.push({ role, parts: [{ text }] });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const isContinuing = contents.length > 1;
  const turnDirective = isContinuing
    ? '\n\n# حالة المحادثة (مهم)\nهذه ليست أول رسالة — المحادثة جارية. ممنوع الترحيب؛ أجب مباشرة. وإذا سأل عن سعر دون ذكر اسم المنتج، فهو يقصد آخر منتج ذُكر.'
    : '\n\n# حالة المحادثة\nهذه أول رسالة — رحّب بجملة قصيرة ثم أجب مباشرة.';

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT + turnDirective }] },
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048, topP: 0.95, thinkingConfig: { thinkingBudget: 768 } },
  });

  let geminiRes = null;
  const start = Math.floor(Math.random() * apiKeys.length);
  for (let i = 0; i < apiKeys.length; i++) {
    const key = apiKeys[(start + i) % apiKeys.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    let r;
    try {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody });
    } catch (e) { continue; }
    if (r.ok) { geminiRes = r; break; }
    await r.text();
    if (r.status !== 429 && r.status !== 503) return res.status(502).json({ error: 'عذراً، حدث خطأ مؤقت. حاول مجدداً.' });
  }

  if (!geminiRes) {
    const hasLatin = /[a-zA-Z]/.test(userMessage);
    const isTr = hasLatin && (/[çğışöüÇĞİŞÖÜ]/.test(userMessage) || /\b(ne kadar|fiyat|merhaba)\b/i.test(userMessage));
    const lang = !hasLatin ? 'ar' : (isTr ? 'tr' : 'en');
    const busy = lang === 'ar' ? 'المساعد مشغول حالياً 🙏 جرّب بعد لحظات.'
      : lang === 'tr' ? 'Asistan şu anda yoğun 🙏 birazdan tekrar deneyin.'
      : 'The assistant is busy right now 🙏 please try again shortly.';
    return res.status(200).json({ reply: busy });
  }

  const data = await geminiRes.json();
  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || '';
  return res.status(200).json({ reply: reply || 'عذراً، لم أفهم تماماً. ممكن تعيد صياغة سؤالك؟' });
}
