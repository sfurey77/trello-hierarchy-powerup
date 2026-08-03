/* global TrelloPowerUp */
const t = TrelloPowerUp.iframe();

t.render(function () {
  // Fetch card basic info AND detailed checklists explicitly
  return Promise.all([
    t.card('id', 'name', 'idList'),
    t.checklists('all') // Explicitly request all checklist items
  ])
  .then(function ([parentCard, checklists]) {
    const listContainer = document.getElementById('item-list');
    listContainer.innerHTML = ''; // Clear loading text

    if (!checklists || checklists.length === 0) {
      listContainer.innerHTML = '<p><em>No checklists found on this card. Add a checklist to get started!</em></p>';
      return t.sizeTo('#content');
    }

    let hasIncomplete = false;

    // Iterate through all fetched checklists
    checklists.forEach(function (checklist) {
      if (checklist.checkItems && checklist.checkItems.length > 0) {
        checklist.checkItems.forEach(function (item) {
          // Check for incomplete state (handles both 'incomplete' string and false boolean)
          if (item.state === 'incomplete' || item.state === false) {
            hasIncomplete = true;
            
            const btn = document.createElement('button');
            btn.className = 'item-btn';
            btn.textContent = `Split: ${item.name}`;
            
            btn.addEventListener('click', function () {
              btn.disabled = true;
              btn.textContent = 'Creating Child Card...';
              createChildCard(item, parentCard);
            });

            listContainer.appendChild(btn);
          }
        });
      }
    });

    if (!hasIncomplete) {
      listContainer.innerHTML = '<p><em>All checklist tasks are completed!</em></p>';
    }

    // Automatically adjust iframe height to fit buttons
    return t.sizeTo('#content');
  })
  .catch(function (err) {
    console.error("Trello rendering error:", err);
    const listContainer = document.getElementById('item-list');
    if (listContainer) {
      listContainer.innerHTML = '<p style="color: red;">Unable to load card data. Try refreshing the page.</p>';
    }
    t.sizeTo('#content');
  });
});

function createChildCard(itemData, parentCard) {
  t.getRestApi()
    .isAuthorized()
    .then(function (isAuthorized) {
      if (!isAuthorized) {
        return t.getRestApi().authorize();
      }
    })
    .then(function () {
      return Promise.all([
        t.getRestApi().getAppKey(),
        t.getRestApi().getToken()
      ]);
    })
    .then(function ([apiKey, token]) {
      // 1. Create Child Card via API
      return fetch(`https://api.trello.com/1/cards?key=${apiKey}&token=${token}`, {
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
          // 3. Update Parent Checklist Item with link
          return fetch(`https://api.trello.com/1/cards/${parentCard.id}/checkItem/${itemData.id}?key=${apiKey}&token=${token}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `${itemData.name} 🔗 [Child Card](${childCard.shortUrl})`
            })
          });
        });
      });
    })
    .then(function () {
      // Refresh or close popup if applicable
      try { t.closePopup(); } catch(e) {}
    })
    .catch(function (err) {
      console.error("Error creating child card:", err);
      alert("Failed to create child card. Ensure Power-Up permissions are authorized.");
    });
}
