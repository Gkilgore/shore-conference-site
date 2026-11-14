// Sends every link to a saved PDF through document.html, so the file opens on the site with a download button.
// Links marked data-direct (the viewer's own buttons) keep pointing at the file. Without JavaScript, links open the PDF.
(() => {
  const viewer = href => {
    const match = /^assets\/documents\/((?:\d{4}-\d{2}\/)?[\w.-]+\.pdf)$/.exec(href || '');
    return match ? 'document.html?file=' + encodeURIComponent(match[1]) : null;
  };
  const route = root => {
    const links = root.matches?.('a') ? [root] : root.querySelectorAll('a[href^="assets/documents/"]');
    for (const link of links) {
      const target = link.hasAttribute('data-direct') ? null : viewer(link.getAttribute('href'));
      if (target) {
        link.setAttribute('href', target);
        link.removeAttribute('target'); // The viewer is a page on this site, so it opens in the same tab.
      }
    }
  };
  route(document);
  // Lists and pop-ups are drawn after the page loads, and some links get their address later.
  new MutationObserver(changes => {
    for (const change of changes) {
      if (change.type === 'attributes') route(change.target);
      else for (const added of change.addedNodes) if (added.nodeType === 1) route(added);
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
})();
