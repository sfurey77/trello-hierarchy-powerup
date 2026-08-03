/* global TrelloPowerUp */

const API_KEY = '6a6efc59de6eeafa3d5e1b1645bfda85'; // <--- PASTE YOUR API KEY HERE

TrelloPowerUp.initialize({
  
  // Render Front-of-Card Badge directly from Card Object
  'card-badges': function (t, options) {
    return t.card('checklists')
      .then(function (card) {
        const checklists = card.checklists || [];
        if (checklists.length === 0) return [];

        let total = 0;
        let complete = 0;

        checklists.forEach(function (cl) {
          (cl.checkItems || []).forEach(function (item) {
            total++;
            if (item.state === 'complete') complete++;
          });
        });

        if (total === 0) return [];

        const pct = Math.round((complete / total) * 100);

        return [{
          text: `Sub-tasks: ${pct}%`,
          color: pct === 100 ? 'green' : (pct > 0 ? 'blue' : 'gray')
        }];
      });
  },

  // Card Sidebar Button
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

  // Main Widget Panel
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
