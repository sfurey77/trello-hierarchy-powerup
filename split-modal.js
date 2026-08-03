/* global TrelloPowerUp */
const t = TrelloPowerUp.iframe();

t.render(function () {
  // Step 1: Get Card ID and List ID
  return t.card('id', 'name', 'idList')
    .then(function (parentCard) {
      const listContainer = document.getElementById('item-list');
      
      // Step 2: Use Trello REST API to fetch checklists directly (bypasses SDK iframe limits)
      return t.getRestApi()
        .isAuthorized()
        .then(function (isAuthorized) {
          if (!isAuthorized) {
            // Prompts user to click to authorize if permissions are missing
            listContainer.innerHTML = '<button id="auth-btn" class="item-btn" style="background:#0052cc; color:white;">Click Here to Authorize Power-Up</button>';
            t.sizeTo('#content');
            document.getElementById('auth-btn').addEventListener('click', function() {
              t.getRestApi().authorize().then(() => location.reload());
            });
            return null;
          }
          return Promise.all([
            t.getRestApi().getAppKey(),
            t.getRestApi().getToken()
          ]);
        })
        .then(function (auth) {
          if (!auth) return;
          const [apiKey, token] = auth;

          // Fetch checklists directly from Trello REST API
          return fetch(`https://api.trello.com/1/cards/${parentCard.id}/checklists?key=${apiKey}&token=${token}`)
            .then(res => res.json())
            .then(function (checklists) {
              listContainer.innerHTML = ''; // Clear loading text

              if (!checklists || checklists.length === 0) {
                listContainer.innerHTML = '<p><em>No checklists found on this card. Add a checklist to get started!</em></p>';
                return t.sizeTo('#content');
              }

              let hasIncomplete = false;

              // Render incomplete items
              checklists.forEach(function (checklist) {
                const checkItems = checklist.checkItems || [];
                checkItems.forEach(function (item) {
                  if (item.state === 'incomplete') {
                    hasIncomplete = true;

                    const btn = document.createElement('button');
                    btn.className = 'item-btn';
                    btn.textContent = `Split: ${item.name}`;

                    btn.addEventListener('click', function () {
                      btn.disabled = true;
                      btn.textContent = 'Creating Child Card...';
                      createChildCard(item, parentCard, apiKey, token);
                    });

                    listContainer.appendChild(btn);
                  }
                });
              });

              if (!hasIncomplete) {
                listContainer.innerHTML = '<p><em>All checklist tasks are completed!</em></p>';
              }

              return t.sizeTo('#content');
            });
        });
    })
    .catch(function (err) {
      console.error("Trello rendering error:", err);
      const listContainer = document.getElementById('item-list');
      if (listContainer) {
        listContainer.innerHTML = '<p style="color: red;">Error reading checklists. Please try refreshing.</p>';
      }
      t.sizeTo('#content');
    });
});

function createChildCard(itemData, parentCard, apiKey, token) {
  // 1. Create Child Card via REST API
  fetch(`https://api.trello.com/1/cards?key=${apiKey}&token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: itemData.name,
      idList: parentCard.idList,
      desc: `**Parent Project:** [${parentCard.name}](https://trello.com/c/${parentCard.id})`
    })
  })
  .then(res => res.json())
  .then(function (childCard) {
    // 2. Save Parent-Child link in PluginData
    return t.set(childCard.id, 'shared', 'parentDetails', {
      parentId: parentCard.id,
      checkitemId: itemData.id
    })
    .then(function () {
      // 3. Update Parent Checklist Item with Child Card link
      return fetch(`https://api.trello.com/1/cards/${parentCard.id}/checkItem/${itemData.id}?key=${apiKey}&token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${itemData.name} 🔗 [Child Card](${childCard.shortUrl})`
        })
      });
    });
  })
  .then(function () {
    // Reload iframe to reflect updated checklist
    location.reload();
  })
  .catch(function (err) {
    console.error("Error creating child card:", err);
    alert("Failed to create child card.");
  });
}
