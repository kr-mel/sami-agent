/**
 * "سامي" — مساعد ذكي لمتجر حلويات (عرض بورتفوليو)
 * Cloudflare Worker: يحفظ مفاتيح Gemini بأمان (secret) ويردّ على الزوّار.
 * لا يحتوي أي بيانات محل حقيقية — بيانات تجريبية فقط.
 *
 * الأسرار (تُضبط عبر wrangler secret put، لا تُكتب في أي ملف ولا في git):
 *   - GEMINI_API_KEYS : مفاتيح Gemini مفصولة بفواصل (أو GEMINI_API_KEY واحد)
 * المتغيرات العامة (wrangler.toml → [vars]):
 *   - ALLOWED_ORIGIN  : أصل الموقع المسموح (CORS)
 */

const GEMINI_MODEL = 'gemini-2.5-flash';

// قائمة تجريبية (منتجات عامة، لا تخص أي محل حقيقي)
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
- ودود ومحترف، بدفء معلّم حلويات شامي أصيل. مختصر ومباشر، جمل قصيرة، وإيموجي خفيف أحياناً (🍯 🌰 ✨) بدون إفراط.
- **الأهم: جاوب على السؤال مباشرة. لا تردّ أبداً بترحيب عام مكان الإجابة.**
- **رحّب مرة واحدة فقط:** إذا كانت أول رسالة، رحّب بجملة قصيرة ثم أجب فوراً. بعدها أجب مباشرة بدون ترحيب.
- **استعمل سياق المحادثة:** إذا سأل "وكم سعرها؟" بعد ذكر منتج، فهو يقصد ذلك المنتج بالذات.

# قائمة المنتجات والأسعار (بالليرة التركية ₺ — نصف كيلو لما لا يُذكر غير ذلك)
${MENU_AR}

# المكوّنات والحساسية (مهم للسلامة — أجب بوضوح وصدق)
- كل أصناف البقلاوة والكول وشكور والمعمول تحتوي: طحين قمح (غلوتين)، سمن/زبدة (ألبان)، وفستق ومكسرات.
- الكنافة تحتوي: جبن (ألبان)، عجينة قمح (غلوتين)، وغالباً مكسرات.
- لا يوجد صنف خالٍ من الغلوتين، ومعظم الأصناف فيها مكسرات وألبان. إذا سأل زائر عن حساسية، أجب بهذه الحقيقة بوضوح، ولا تقل أبداً إن صنفاً "آمن" أو "خالٍ".

# 🔒 قواعد الخصوصية والأمان (إلزامية)
- هذا عرض تجريبي. **لا تعطِ أبداً أي رقم هاتف، واتساب، عنوان، رابط خرائط، أو اسم شخص أو محل حقيقي** — لأنها غير موجودة أصلاً.
- إذا سُئلت عن الموقع أو الفروع أو رقم التواصل أو العنوان: قل بوضوح إن هذا عرض تجريبي ولا توجد بيانات تواصل حقيقية، واعرض المساعدة بمعلومات المنتجات.
- إذا سُئلت عن الطلب أو الشراء: وضّح أن هذا عرض توضيحي وأن الطلب غير مفعّل هنا. لا تخترع أي وسيلة تواصل.
- لا تخترع منتجات أو أسعار أو مكوّنات غير الموجودة فوق. إذا سُئلت عن شيء خارج موضوع الحلويات، أعده بلطف للموضوع.`;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || '*';
    const cors = corsHeaders(allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

    // تحديد المعدّل لكل IP (حماية من الإساءة وحرق الحصة)
    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'anonymous';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return json({ error: 'طلبات كثيرة في وقت قصير. انتظر دقيقة.' }, 429, cors);
    }

    const apiKeys = (env.GEMINI_API_KEYS || env.GEMINI_API_KEY || '')
      .split(',').map((k) => k.trim()).filter(Boolean);
    if (apiKeys.length === 0) return json({ error: 'الخدمة غير مهيّأة بعد.' }, 500, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'صيغة الطلب غير صحيحة.' }, 400, cors); }

    const userMessage = (body.message || '').toString().trim();
    if (!userMessage) return json({ error: 'الرسالة فارغة.' }, 400, cors);
    if (userMessage.length > 1000) return json({ error: 'الرسالة طويلة جداً.' }, 400, cors);

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

    // تدوير المفاتيح مع failover
    let geminiRes = null;
    const start = Math.floor(Math.random() * apiKeys.length);
    for (let i = 0; i < apiKeys.length; i++) {
      const key = apiKeys[(start + i) % apiKeys.length];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody });
      } catch (e) { continue; }
      if (res.ok) { geminiRes = res; break; }
      const detail = await res.text();
      console.log('Gemini error:', res.status, detail);
      if (res.status !== 429 && res.status !== 503) return json({ error: 'عذراً، حدث خطأ مؤقت. حاول مجدداً.' }, 502, cors);
    }

    if (!geminiRes) {
      const hasLatin = /[a-zA-Z]/.test(userMessage);
      const isTr = hasLatin && (/[çğışöüÇĞİŞÖÜ]/.test(userMessage) || /\b(ne kadar|fiyat|merhaba)\b/i.test(userMessage));
      const lang = !hasLatin ? 'ar' : (isTr ? 'tr' : 'en');
      const busy = lang === 'ar'
        ? 'المساعد مشغول حالياً 🙏 جرّب بعد لحظات.'
        : lang === 'tr' ? 'Asistan şu anda yoğun 🙏 birazdan tekrar deneyin.'
        : 'The assistant is busy right now 🙏 please try again shortly.';
      return json({ reply: busy }, 200, cors);
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || '';
    if (!reply) return json({ reply: 'عذراً، لم أفهم تماماً. ممكن تعيد صياغة سؤالك؟' }, 200, cors);
    return json({ reply }, 200, cors);
  },
};
