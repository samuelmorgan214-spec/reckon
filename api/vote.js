import { serviceClient } from '../lib/supabase.js';

// POST /api/vote  { slug, voter_id, choice: "yes"|"no" }
// Records one reader's Yeah/Nah on a market. Upserts on (market_slug, voter_id)
// so a person changing their mind updates their vote instead of stacking.
// Returns the fresh tally { yes_votes, no_votes } for that market.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const slug = String(req.body?.slug || '').trim();
  const voterId = String(req.body?.voter_id || '').trim();
  const choice = String(req.body?.choice || '').trim();

  if (!slug || slug.length > 120) return res.status(400).json({ error: 'bad slug' });
  if (!voterId || voterId.length > 100) return res.status(400).json({ error: 'bad voter id' });
  if (choice !== 'yes' && choice !== 'no') return res.status(400).json({ error: 'choice must be yes or no' });

  try {
    const supabase = serviceClient();

    // Only accept votes for markets that actually exist — keeps the table clean.
    const { data: market } = await supabase.from('markets').select('slug').eq('slug', slug).single();
    if (!market) return res.status(404).json({ error: 'unknown market' });

    const { error } = await supabase
      .from('votes')
      .upsert(
        { market_slug: slug, voter_id: voterId, choice, updated_at: new Date().toISOString() },
        { onConflict: 'market_slug,voter_id' }
      );
    if (error) throw error;

    const { data: tally } = await supabase
      .from('vote_tallies')
      .select('yes_votes, no_votes')
      .eq('market_slug', slug)
      .maybeSingle();

    res.status(200).json({
      ok: true,
      yes_votes: tally?.yes_votes || 0,
      no_votes: tally?.no_votes || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'could not record vote' });
  }
}
