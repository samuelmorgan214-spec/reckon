import { serviceClient } from '../lib/supabase.js';

// POST /api/subscribe  {email}
// Captures to our own table. Provider-agnostic on purpose: the list stays ours
// and any email provider can sync from the subscribers table later.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'That email does not look right' });
  }
  try {
    const supabase = serviceClient();
    const { error } = await supabase
      .from('subscribers')
      .upsert({ email, source: 'site' }, { onConflict: 'email', ignoreDuplicates: true });
    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not subscribe right now' });
  }
}
