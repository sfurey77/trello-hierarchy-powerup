/* global TrelloPowerUp */

// 1. Paste your 32-character Trello API Key between quotes below:
const API_KEY = '6a6efc59de6eeafa3d5e1b1645bfda85';

TrelloPowerUp.initialize({
  
  // Capability 1: Progress Badge on Front of Parent Card
  'card-badges': function (t, options) {
    return t.card('checklists')
      .then(function (card) {
        if (!card.checklists || card.checklists.length === 0) {
          return [];
        }

        let totalItems = 0;
        let completeItems = 0;

        card.checklists.forEach(function (checklist) {
          if (checklist.checkItems) {
            checklist.checkItems.forEach(function (item) {
              totalItems++;
              if (item.state === 'complete') {
                completeItems++;
              }
            });
          }
        });

        if (totalItems === 0) return [];

        const percentage = Math.round((completeItems / totalItems) * 100);

        return [{
          text: `Sub-tasks: ${percentage}%`,
          color: percentage === 100 ? 'green' : (percentage > 0 ? 'blue' : 'gray')
        }];
      });
  },

  // Capability 2: Card Button (Right Sidebar)
  'card-buttons': function (t, options) {
    return [{
      icon: 'https://cdn.icon-icons.com/icons2/2248/SHA/512/sitemap_icon_138865.png',
      text: 'Split Task to Child Card',
      callback: function (t) {
        return t.popup({
          title: 'Split Checklist Item',
          url: './split-modal.html',
          height: 280
        });
      }
    }];
  },

  // Capability 3: Detect when Child Card is Completed/Archived -> Auto-Complete Parent Checklist Item
  'card-detail-badges': function (t, options) {
    return t.card('id', 'closed', 'desc')
      .then(function (card) {
        // Only run sync logic if the child card is archived (closed)
        if (card.closed && card.desc) {
          // Extract Parent Card ID from description link (https://trello.com/c/{parentId})
          const match = card.desc.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
          if (!match) return [];

          const parentCardId = match[1];

          return t.getRestApi()
            .isAuthorized()
            .then(function (isAuthorized) {
              if (!isAuthorized) return [];

              return t.getRestApi().getToken().then(function (token) {
                if (!token) return [];

                // Fetch parent card checklists to match child card short link or name
                return fetch(`https://api.trello.com/1/cards/${parentCardId}/checklists?key=${API_KEY}&token=${token}`)
                  .then(res => res.json())
                  .then(function (checklists) {
                    if (!checklists) return [];

                    checklists.forEach(function (checklist) {
                      (checklist.checkItems || []).forEach(function (item) {
                        // If item links to this child card short ID/URL, mark it complete
                        if (item.name.includes(card.id) || item.name.includes(card.id.slice(-6))) {
                          fetch(`https://api.trello.com/1/cards/${parentCardId}/checkItem/${item.id}?key=${API_KEY}&token=${token}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ state: 'complete' })
                          });
                        }
                      });
                    });

                    return [];
                  });
              });
            });
        }
        return [];
      });
  },

  // Capability 4: Card Back Section Widget
  'card-back-section': function (t, options) {
    return {
      title: 'Task Hierarchy Manager',
      icon: 'https://cdn.icon-icons.com/icons2/2248/SHA/512/sitemap_icon_138865.png',
      content: {
        type: 'iframe',
        url: t.signUrl('./split-modal.html'),
        height: 180
      }
    };
  }

}, {
  appKey: API_KEY,
  appName: 'Task Hierarchy Power-Up'
});
