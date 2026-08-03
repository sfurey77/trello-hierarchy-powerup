/* global TrelloPowerUp */

// 1. Paste your 32-character Trello API Key between quotes below:
const API_KEY = '6a6efc59de6eeafa3d5e1b1645bfda85';

const t = TrelloPowerUp.iframe({
  appKey: API_KEY,
  appName: 'Task Hierarchy Power-Up'
});

t.render(function () {
  const listContainer = document.getElementById('item-list');
  if (!listContainer) return;

  return t.card('id', 'name', 'idList')
    .then(function (parentCard) {
      
      // Helper function to render the authorization button
      function renderAuthButton() {
        listContainer.innerHTML = '<button id="auth-btn" class="item-btn" style="background:#0052cc; color:white; font-weight:bold; padding:10px; width:100%; border:none; border-radius:3px; cursor:pointer;">Click Here to Authorize Power-Up</button>';
        t.sizeTo('#content');

        const authBtn = document.getElementById('auth-btn');
        if (authBtn) {
          authBtn.onclick = function() {
            t.getRestApi()
              .authorize({ scope: 'read,write', expiration: 'never' })
              .then(function() {
                location.reload();
              })
              .catch(function(authErr) {
                console.error("Authorization failed:", authErr);
                alert("Authorization failed or was closed. Please try again.");
              });
          };
        }
      }

      // Check if REST API capability is ready and authorized
      const restApi = t.getRestApi();
      
      if (!restApi) {
        listContainer.innerHTML = '<p style="color:red;">REST API not available. Check client.js initialization.</p>';
        return t.sizeTo('#content');
      }

      return restApi.isAuthorized()
        .then(function (isAuth) {
          if (!isAuth) {
            renderAuthButton();
            return;
          }

          // User IS authorized -> fetch token & list checklists
          return restApi.getToken().then(function (token) {
            if (!token) {
              renderAuthButton();
              return;
            }

            return fetch(`https://api.trello.com/1/cards/${parentCard.id}/checklists?key=${API_KEY}&token=${token}`)
              .then(function (res) {
                if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);
                return res.json();
              })
              .then(function (checklists) {
                listContainer.innerHTML = '';

                if (!checklists || checklists.length === 0) {
                  listContainer.innerHTML = '<p><em>No checklists found on this card. Add a checklist to get started!</em></p>';
                  return t.sizeTo('#content');
                }

                let hasIncomplete = false;

                checklists.forEach(function (checklist) {
                  const checkItems = checklist.checkItems || [];
                  checkItems.forEach(function (item) {
                    if (item.state === 'incomplete') {
                      hasIncomplete = true;

                      const btn = document.createElement('button');
                      btn.className = 'item-btn';
                      btn.textContent = `Split: ${item.name}`;

                      btn.onclick = function () {
                        btn.disabled = true;
                        btn.textContent = 'Creating Child Card...';
                        createChildCard(item, parentCard, token);
                      };

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
          console.error("Auth status error:", err);
          renderAuthButton();
        });
    })
    .catch(function (err) {
      console.error("Card data error:", err);
      listContainer.innerHTML = '<p style="color: red;">Error loading card details. Try reloading the browser page.</p>';
      t.sizeTo('#content');
    });
});

function createChildCard(itemData, parentCard, token) {
  fetch(`https://api.trello.com/1/cards?key=${API_KEY}&token=${token}`, {
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
    return t.set(childCard.id, 'shared', 'parentDetails', {
      parentId: parentCard.id,
      checkitemId: itemData.id
    })
    .then(function () {
      return fetch(`https://api.trello.com/1/cards/${parentCard.id}/checkItem/${itemData.id}?key=${API_KEY}&token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${itemData.name} 🔗 [Child Card](${childCard.shortUrl})`
        })
      });
    });
  })
  .then(function () {
    location.reload();
  })
  .catch(function (err) {
    console.error("Error creating child card:", err);
    alert("Failed to create child card. Please check network connection.");
  });
}
