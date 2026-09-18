# سامي · مساعد متجر الحلويات الذكي — Sami AI Assistant

مساعد ذكاء اصطناعي متعدّد اللغات (عربي / تركي / إنجليزي) لمتجر حلويات شامية.
A multilingual (AR / TR / EN) AI assistant agent for a Damascus sweet shop.

**🔗 Live demo:** https://kr-mel.github.io/sami-agent/

> عرض بورتفوليو — لا يحتوي أي بيانات محل حقيقية.
> Portfolio demo — contains no real business data.

## المعمارية / Architecture
- **الواجهة / Frontend:** صفحة شات كاملة بـ Vanilla JS + CSS (RTL، متجاوبة، وضع داكن) على **GitHub Pages**.
- **الخادم / Backend:** دالة **Vercel Serverless** (`api/chat.js`) تستدعي **Google Gemini** (`gemini-2.5-flash`).
- **الأمان / Security:** مفتاح الـ API محفوظ كـ **environment secret** على Vercel — لا يظهر أبداً في الكود ولا في المتصفح ولا في git.
- **موثوقية / Reliability:** تدوير عدّة مفاتيح مع تجاوز الأعطال (failover)، وتحديد معدّل لكل IP.
- **خصوصية / Privacy:** البوت مُقيَّد بعدم تسريب أي رقم أو عنوان أو بيانات تواصل.

## المميزات / Features
- كشف لغة الرسالة والرد بنفس اللغة تلقائياً.
- ذاكرة سياق المحادثة، ومعرفة بالمنتجات والأسعار والمكوّنات/الحساسية.
- تنسيق ردود Markdown، مؤشر كتابة، واقتراحات جاهزة.

## البنية / Structure
- `index.html` — تطبيق الشات المستقل (self-contained) → GitHub Pages.
- `api/chat.js` — دالة Vercel Serverless (المفتاح يُضبط كـ env secret، لا يُكتب في الكود).
