const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const formatOrderMessage = (order) => {
  const customer = order?.customer || {};
  const items = Array.isArray(order?.items) ? order.items : [];

  const itemsText = items
    .map((item) => `• ${escapeHtml(item.name)} × ${item.qty}`)
    .join('\n');

  return [
    '🛒 <b>طلب جديد من المتجر</b>',
    '',
    `<b>الاسم:</b> ${escapeHtml(customer.name || '-')}`,
    `<b>الهاتف:</b> ${escapeHtml(customer.phone || '-')}`,
    `<b>الولاية:</b> ${escapeHtml(customer.wilaya_name || customer.wilaya || '-')}`,
    `<b>البلدية:</b> ${escapeHtml(customer.commune_name || customer.commune || customer.city || '-')}`,
    '',
    '<b>المنتجات:</b>',
    itemsText || '-',
    '',
    `<b>الإجمالي:</b> ${Number(order?.totalPrice || 0)} د.ج`,
  ].join('\n');
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ error: 'Missing Telegram configuration' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const order = body?.order;

    if (!order) {
      return res.status(400).json({ error: 'Order payload is required' });
    }

    const message = formatOrderMessage(order);

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult?.ok) {
      return res.status(502).json({
        error: 'Telegram API failed',
        details: telegramResult,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      details: String(error?.message || error),
    });
  }
}
