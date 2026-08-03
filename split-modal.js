/* global TrelloPowerUp */
const t = TrelloPowerUp.iframe();

t.render(function () {
  t.card('id', 'name', 'idList', 'checklists')
    .then(function (parentCard) {
      const listContainer = document.getElementById('item-list');
      listContainer.innerHTML = ''; // Clear loading text

      if (!parentCard.checklists || parentCard.checklists.length === 0) {
        listContainer.innerHTML = '<p><em>No checklists found on this card.</em></p>';
        return t.sizeTo('#content');
      }

      let hasIncomplete = false;

      // Create a button for every incomplete checklist item
      parentCard.checklists.forEach(function (checklist) {
        checklist.checkItems.forEach(function (item) {
          if (item.state === 'incomplete') {
            hasIncomplete = true;
            
            const btn = document.createElement('button');
            btn.className = 'item-btn';
            btn.textContent = `Split: ${item.name}`;
            
            // When clicked, trigger the split logic
            btn.addEventListener('click', function () {
              btn.disabled = true;
              btn.textContent = 'Creating Child Card...';
              createChildCard(item, parentCard);
            });

            listContainer.appendChild(btn);
          }
        });
      });

      if (!hasIncomplete) {
        listContainer.innerHTML = '<p><em>All tasks are completed!</em></p>';
      }

      // Tell Trello to automatically stretch the iframe to fit these buttons
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
        // 2. Save Link in PluginData
        return t.set(childCard.id, 'shared', 'parentDetails', {
          parentId: parentCard.id,
          checkitemId: itemData.id
        })
        .then(function () {
          // 3. Update Parent Checklist Item
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
      // Close the popup window if it was opened from the sidebar button
      try { t.closePopup(); } catch(e) {}
    })
    .catch(function (err) {
      console.error("Error creating child card:", err);
    });
}
