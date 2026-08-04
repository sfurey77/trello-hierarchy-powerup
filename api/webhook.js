export default async function handler(req, res) {
  // 1. Trello Webhook Verification
  if (req.method === 'HEAD') {
    return res.status(200).send('OK');
  }

  if (req.method === 'POST') {
    try {
      const action = req.body?.action;
      console.log("Incoming Trello Webhook Action:", action?.type, action?.data);

      // Check if action involves closing/archiving a card
      const isClosed = action?.data?.card?.closed === true || action?.type === 'updateCard' && action?.data?.old?.closed === false;

      if (isClosed && action?.data?.card?.id) {
        const childCardId = action.data.card.id;
        const apiKey = process.env.TRELLO_API_KEY;
        const token = process.env.TRELLO_TOKEN;

        if (!apiKey || !token) {
          console.error("CRITICAL: Missing TRELLO_API_KEY or TRELLO_TOKEN in Vercel Environment Variables");
          return res.status(200).json({ error: "Missing environment variables" });
        }

        // Fetch full child card details to get description and shortLink
        const childRes = await fetch(`https://api.trello.com/1/cards/${childCardId}?key=${apiKey}&token=${token}`);
        if (!childRes.ok) {
          console.error("Failed to fetch child card details:", childRes.status);
          return res.status(200).json({ error: "Child card fetch failed" });
        }

        const childCard = await childRes.json();
        const desc = childCard.desc || '';
        console.log("Child Card Description:", desc);

        // Extract Parent Card ID from description link (https://trello.com/c/PARENT_ID)
        const match = desc.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
        
        if (match) {
          const parentCardId = match[1];
          console.log("Found Parent Card ID:", parentCardId);

          // Fetch parent card checklists
          const checklistsRes = await fetch(`https://api.trello.com/1/cards/${parentCardId}/checklists?key=${apiKey}&token=${token}`);
          const checklists = await checklistsRes.json();

          if (Array.isArray(checklists)) {
            for (const checklist of checklists) {
              for (const item of (checklist.checkItems || [])) {
                // Match shortLink, shortUrl, or ID
                const isMatch = (childCard.shortLink && item.name.includes(childCard.shortLink)) || 
                                (childCard.shortUrl && item.name.includes(childCard.shortUrl)) ||
                                item.name.includes(childCard.id);

                if (isMatch) {
                  console.log(`MATCH FOUND! Updating parent checkItem ${item.id} to complete...`);
                  
                  const updateRes = await fetch(
                    `https://api.trello.com/1/cards/${parentCardId}/checkItem/${item.id}?key=${apiKey}&token=${token}`,
                    {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ state: 'complete' })
                    }
                  );
                  
                  console.log("Update response status:", updateRes.status);
                }
              }
            }
          }
        } else {
          console.log("No parent card URL match found in child description.");
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Webhook Execution Error:", error);
      return res.status(200).json({ error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
