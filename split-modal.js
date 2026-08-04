/* global TrelloPowerUp */

const API_KEY = '6a6efc59de6eeafa3d5e1b1645bfda85'; // <--- PASTE YOUR API KEY HERE

const t = TrelloPowerUp.iframe({
  appKey: API_KEY,
  appName: 'Task Hierarchy Power-Up'
});

t.render(function () {
  const listContainer = document.getElementById('item-list');
  if (!listContainer) return;

  return t.card('id', 'name', 'idList')
    .then(function (parentCard) {
      const restApi = t.getRestApi();

      return restApi.isAuthorized()
        .then(function (isAuth) {
          if (!isAuth) {
            renderAuthButton(listContainer);
            return;
          }

          loadChecklists(parentCard, listContainer, restApi);
        })
        .catch(function (err) {
          console.error("Auth status error:", err);
          renderAuthButton(listContainer);
        });
    });
});

function renderAuthButton(listContainer) {
  listContainer.innerHTML = '<button id="auth-btn" style="background:#0052cc; color:white; font-weight:600; padding:8px 12px; width:100%; border:none; border-radius:3px; cursor:pointer;">Authorize Write Permissions</button>';
  t.sizeTo('#content');

  const authBtn = document.getElementById('auth-btn');
  if (authBtn) {
    authBtn.onclick = function() {
      t.getRestApi()
        .authorize({ scope: 'read,write', expiration: 'never' })
        .then(function() {
          location.reload();
        });
    };
  }
}

function loadChecklists(parentCard, listContainer, restApi) {
  restApi.getToken().then(function (token) {
    if (!token) return;

    fetch(`https://api.trello.com/1/cards/${parentCard.id}/checklists?key=${API_KEY}&token=${token}`)
      .then(res => res.json())
      .then(function (checklists) {
        listContainer.innerHTML = '';

        if (!checklists || checklists.length === 0) {
          listContainer.innerHTML = '<p style="font-size:13px; color:#6b778c; margin:0;"><em>No checklists found on this card. Add a checklist to get started.</em></p>';
          return t.sizeTo('#content');
        }

        let totalTasks = 0;
        let completedTasks = 0;
        const incompleteItems = [];

        checklists.forEach(function (checklist) {
          (checklist.checkItems || []).forEach(function (item) {
            totalTasks++;
            if (item.state === 'complete') {
              completedTasks++;
            } else {
              incompleteItems.push(item);
            }
          });
        });

        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const barColor = percentage === 100 ? '#00875a' : '#0052cc';

        // Render Clean Progress Bar
        const progressHTML = `
          <div class="progress-container">
            <div class="progress-header">
              <span>Sub-task Completion</span>
              <span>${percentage}% (${completedTasks}/${totalTasks})</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${percentage}%; background-color: ${barColor};"></div>
            </div>
          </div>
        `;

        listContainer.innerHTML = progressHTML;

        // Render Rows
        if (incompleteItems.length > 0) {
          const rowsContainer = document.createElement('div');
          rowsContainer.className = 'item-list';

          incompleteItems.forEach(function (item) {
            const row = document.createElement('div');
            row.className = 'item-row';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = item.name;

            const btn = document.createElement('button');
            btn.className = 'btn-split';
            btn.textContent = 'Split to Card';

            btn.onclick = function () {
              btn.disabled = true;
              btn.textContent = 'Creating...';
              createChildCard(item, parentCard, token, btn);
            };

            row.appendChild(nameSpan);
            row.appendChild(btn);
            rowsContainer.appendChild(row);
          });

          listContainer.appendChild(rowsContainer);
        } else if (totalTasks > 0) {
          const doneMsg = document.createElement('p');
          doneMsg.style.cssText = 'font-size:13px; color:#00875a; font-weight:600; margin:8px 0 0 0;';
          doneMsg.innerHTML = '🎉 All sub-tasks completed!';
          listContainer.appendChild(doneMsg);
        }

        return t.sizeTo('#content');
      });
  });
}

function createChildCard(itemData, parentCard, token, buttonElement) {
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
    return fetch(`https://api.trello.com/1/cards/${parentCard.id}/checkItem/${itemData.id}?key=${API_KEY}&token=${token}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${itemData.name} 🔗 [Child Card](${childCard.shortUrl})`
      })
    });
  })
  .then(function () {
    if (buttonElement) {
      buttonElement.textContent = '✅ Created';
      buttonElement.classList.add('btn-success');
    }
  })
  .catch(function (err) {
    alert(`Failed to create child card: ${err.message}`);
  });
}
