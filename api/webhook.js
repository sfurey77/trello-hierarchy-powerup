export default async function handler(req, res) {
  // 1. Trello Webhook Verification (HEAD Request)
  // Trello sends a HEAD request when creating the webhook to verify the URL is active.
  if (req.method === 'HEAD') {
    return res.status(200).send('OK');
  }

  // 2. Handle Event Notification (POST Request)
  if (req.method === 'POST') {
    try {
      const action = req.body?.action;

      // Listen for card archival / closure events
      if (action && action.type === 'updateCard' && action.data.card.closed === true) {
        const childCard = action.data.card;
        const desc = childCard.desc || '';

        // Extract Parent Card Short Link or ID from Description
        const match = desc.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
        
        if (match) {
          const parentCardId = match[1];
          const apiKey = process.env.TRELLO_API_KEY;
          const token = process.env.TRELLO_TOKEN;

          if (apiKey && token) {
            // Fetch parent card checklists from Trello API
            const checklistsRes = await fetch(
              `https://api.trello.com/1/cards/${parentCardId}/checklists?key=${apiKey}&token=${token}`
            );
            const checklists = await checklistsRes.json();

            if (Array.isArray(checklists)) {
              for (const checklist of checklists) {
                for (const item of (checklist.checkItems || [])) {
                  // If checklist item links to this child card, mark it complete
                  if (item.name.includes(childCard.shortLink) || item.name.includes(childCard.id)) {
                    await fetch(
                      `https://api.trello.com/1/cards/${parentCardId}/checkItem/${item.id}?key=${apiKey}&token=${token}`,
                      {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ state: 'complete' })
                      }
                    );
                  }
                }
              }
            }
          }
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return res.status(200).json({ error: error.message }); // Always return 200 to Trello
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
