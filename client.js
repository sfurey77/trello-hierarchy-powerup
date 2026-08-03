/* global TrelloPowerUp */

// Initialize Power-Up Capabilities
TrelloPowerUp.initialize({
  
  // Capability 1: Render completion % badge on card front
  'card-badges': function (t, options) {
    return t.card('checklists')
      .then(function (card) {
        if (!card.checklists || card.checklists.length === 0) {
          return [];
        }

        let totalItems = 0;
        let completeItems = 0;

        card.checklists.forEach(function (checklist) {
          checklist.checkItems.forEach(function (item) {
            totalItems++;
            if (item.state === 'complete') {
              completeItems++;
            }
          });
        });

        if (totalItems === 0) return [];

        const percentage = Math.round((completeItems / totalItems) * 100);

        return [{
          text: `Sub-tasks: ${percentage}%`,
          color: percentage === 100 ? 'green' : 'blue'
        }];
      });
  },

  // Capability 2: Add card button to trigger splitting
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

  // Capability 3: Detect when child card opens/archives to update parent checklist
  'card-detail-badges': function (t, options) {
    return t.card('id', 'closed')
      .then(function (card) {
        // If child card is archived (closed)
        if (card.closed) {
          return t.get(card.id, 'shared', 'parentDetails')
            .then(function (parentDetails) {
              if (!parentDetails) return [];

              const { parentId, checkitemId } = parentDetails;

              // Authorize & update parent card checklist item
              return t.getRestApi()
                .getToken()
                .then(function (token) {
                  if (!token) return [];

                  return t.getRestApi().getAppKey().then(function (apiKey) {
                    return fetch(`https://api.trello.com/1/cards/${parentId}/checkItem/${checkitemId}?key=${apiKey}&token=${token}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ state: 'complete' })
                    });
                  });
                });
            });
        }
        return [];
      });
  }
});
