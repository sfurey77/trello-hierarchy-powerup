export default async function handler(req, res) {
  // 1. Trello Webhook Verification (HEAD Request)
  if (req.method === 'HEAD') {
    return res.status(200).send('OK');
  }

  // 2. Handle Event Notification (POST Request)
  if (req.method === 'POST') {
    try {
      const action = req.body?.action;

      // Check if a card was archived (closed: true) or updated
      if (action && action.type === 'updateCard' && action.data?.card?.closed === true) {
        const childCard = action.data.card;
        
        // Fetch full child card details to get full description & shortLink
        const apiKey = process.env.TRELLO_API_KEY;
        const token = process.env.TRELLO_TOKEN;

        if (!apiKey || !token) {
          console.error("Missing API Key or Token in Vercel Environment Variables");
          return res.status(200).json({ error: "Missing environment variables" });
        }

        const childDetailsRes = await fetch(
          `https://api.trello.com/1/cards/${childCard.id}?key=${apiKey}&token=${token}`
        );
        const childDetails = await childDetailsRes.json();
        const desc = childDetails.desc || '';

        // Extract Parent Card Short Link or ID from Description (https://trello.com/c/PARENT_ID)
        const match = desc.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
        
        if (match) {
          const parentCardId = match[1];

          // Fetch parent card checklists
          const checklistsRes = await fetch(
            `https://api.trello.com/1/cards/${parentCardId}/checklists?key=${apiKey}&token=${token}`
          );
          const checklists = await checklistsRes.json();

          if (Array.isArray(checklists)) {
            for (const checklist of checklists) {
              for (const item of (checklist.checkItems || [])) {
                
                // Match checklist item if it contains the child card's shortLink OR id OR shortUrl
                const isMatch = item.name.includes(childDetails.shortLink) || 
                                item.name.includes(childDetails.id) || 
                                (childDetails.shortUrl && item.name.includes(childDetails.shortUrl));

                if (isMatch && item.state !== 'complete') {
                  console.log(`Marking checklist item ${item.id} complete on parent card ${parentCardId}`);
                  
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

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(200).json({ error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
