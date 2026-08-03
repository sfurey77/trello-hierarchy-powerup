/* global TrelloPowerUp */
const t = TrelloPowerUp.iframe();

t.render(function () {
  t.card('id', 'name', 'idList', 'checklists')
    .then(function (parentCard) {
      const select = document.getElementById('item-select');
      select.innerHTML = '';

      if (!parentCard.checklists || parentCard.checklists.length === 0) {
        select.innerHTML = '<option value="">No checklists found</option>';
        return;
      }

      // Populate dropdown with incomplete checklist items
      parentCard.checklists.forEach(function (checklist) {
        checklist.checkItems.forEach(function (item) {
          if (item.state === 'incomplete') {
            const opt = document.createElement('option');
            opt.value = JSON.stringify({ id: item.id, name: item.name });
            opt.textContent = `${checklist.name}: ${item.name}`;
            select.appendChild(opt);
          }
        });
      });
    });
});

document.getElementById('split-btn').addEventListener('click', function () {
  const selectedValue = document.getElementById('item-select').value;
  if (!selectedValue) return;

  const itemData = JSON.parse(selectedValue);

  // Authenticate user with Trello REST API
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
        t.getRestApi().getToken(),
        t.card('id', 'name', 'idList')
      ]);
    })
    .then(function ([apiKey, token, parentCard]) {
      // 1. Create Child Card via Trello API
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
        // 2. Save Parent-Child Link in PluginData on the Child Card
        return t.set(childCard.id, 'shared', 'parentDetails', {
          parentId: parentCard.id,
          checkitemId: itemData.id
        })
        .then(function () {
          // 3. Update Parent Checklist Item to include Link
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
      t.closePopup();
    })
    .catch(function (err) {
      console.error("Error creating child card:", err);
    });
});
