function waitForElm(selector) {
  return new Promise(resolve => {
    document.getElementById(selector) && resolve(document.getElementById(selector));

    const observer = new MutationObserver(() =>
      document.getElementById(selector) && resolve(document.getElementById(selector)) && observer.disconnect()
    );

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

(async () => {
  const div = document.createElement('div');
  div.id = 'sbx-panel';
  div.innerHTML = await fetch(chrome.runtime.getURL('panel.html')).then(res => res.text());
  const runningGames = await waitForElm('rbx-running-games');

  runningGames.parentNode.insertBefore(div, runningGames);
})();

