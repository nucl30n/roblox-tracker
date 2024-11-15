const COLORS = {
  GREEN: '#00b06f',
  BLUE: '#0077ff',
  RED: '#ff3e3e',
};

const { getURL } = chrome.runtime;

const USER = {
  SUCCESS: getURL('images/user-success.png'),
  NEUTRAL: getURL('images/user.png'),
  ERROR: getURL('images/user-error.png'),
};

const sleep = time => new Promise(res => setTimeout(res, time * 1000));

const get = async (url) => {
  try {
    const request = await fetch(url);
    if (!request.ok) throw new Error('Request failed');
    return await request.json();
  } catch (error) {
    await sleep(0.2);
    return await get(url);
  }
};

const post = async (url, body) => {
  try {
    const request = await fetch(url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!request.ok) throw new Error('Request failed');
    return await request.json();
  } catch (error) {
    await sleep(0.2);
    return await post(url, body);
  }
};

const panel = document.getElementById('sbx-panel');
const search = document.getElementById('sbx-search');
const input = document.getElementById('sbx-input');
const status = document.getElementById('sbx-status');
const icon = document.getElementById('sbx-user');
const bar = document.getElementById('sbx-bar');

search.src = getURL('images/search.png');
icon.src = getURL('images/user.png');

const color = hex => {
  bar.style.backgroundColor = hex;
  search.style.backgroundColor = hex;
};

input.oninput = () => {
  const test = /(^(?=^[^_]+_?[^_]+$)\w{3,20}$|^\d+$)/.test(input.value);
  if (!input.value) icon.src = USER.NEUTRAL;
  else icon.src = test ? USER.SUCCESS : USER.ERROR;
  search.disabled = !test;
};

let searching = false;
let canceled = false;
let foundAllServers = false;
let searchingTarget = true;
let allPlayers = [];
let playersCount = 0;
let targetsChecked = 0;
let maxPlayers = 0;

let targetServersId = [];
let highlighted = [];

const allThumbnails = new Map();

async function fetchServers(place = '', cursor = '', attempts = 0) {
  const response = await fetch(`https://games.roblox.com/v1/games/${place}/servers/Public?limit=100&cursor=${cursor}`);
  const { nextPageCursor, data } = await response.json();

  foundAllServers = (attempts >= 30) ? true : foundAllServers;

  if (!data || data.length === 0) {
    await sleep(1);
    return fetchServers(place, cursor, attempts + 1);
  }

  for (const s of data) {
    for (const t of s.playerTokens) {
      playersCount += 1;
      allPlayers.push({
        token: t,
        type: 'AvatarHeadshot',
        size: '150x150',
        requestId: s.id,
      });
    }

    maxPlayers = s.maxPlayers;
  }

  if (!nextPageCursor || canceled) {
    foundAllServers = true;
    return;
  }

  return fetchServers(place, nextPageCursor);
}

async function findTarget(imageUrl, place) {

  panel.appendChild(document.createElement('img')).src = imageUrl;
  while (searchingTarget) {
    if (canceled) {
      searchingTarget = false;
    }

    const chosenPlayers = [];

    for (let i = 0; i < 100; i++) {
      const playerToken = allPlayers.shift();
      if (!playerToken) break;
      chosenPlayers.push(playerToken);
    }

    if (!chosenPlayers.length) {
      await sleep(0.1);
      if (targetsChecked === playersCount && foundAllServers) {
        break;
      }
      continue;
    }

    post('https://thumbnails.roblox.com/v1/batch', JSON.stringify(chosenPlayers)).then(({ data: thumbnailsData }) => {
      if (canceled) return;

      for (const th of thumbnailsData) {
        const thumbnails = allThumbnails.get(th.requestId) || [];

        thumbnails.length == 0 && allThumbnails.set(th.requestId, thumbnails);

        targetsChecked += 1;

        !thumbnails.includes(th.imageUrl) && thumbnails.push(th.imageUrl);

        bar.style.width = `${Math.round((targetsChecked / playersCount) * 100)}%`;

        if (th.imageUrl === imageUrl) {
          renderServers();
          targetServersId.push(th.requestId);
          searchingTarget = false;
        }
      }
    });
  }

  if (targetServersId.length) {
    for (const targetServerId of targetServersId) {
      icon.src = getURL('images/user-success.png');
      color(COLORS.GREEN);
      setTimeout(() => color(COLORS.BLUE), 1000);

      const first = document.querySelectorAll('.rbx-game-server-item')[0] || document.querySelectorAll('#rbx-running-games > div.section-content-off.empty-game-instances-container > p')[0];

      if (first.className == 'no-servers-message') {
        first.parentNode.style['display'] = 'flex';
        first.parentNode.style['flex-direction'] = 'column';
      }

      const item = document.createElement('li');

      const thumbnails = allThumbnails.get(targetServerId);

      item.className = 'stack-row rbx-game-server-item highlighted';
      item.innerHTML = `
      <div class="section-left rbx-game-server-details'">
      <div class="text-info rbx-game-status rbx-game-server-status'">${thumbnails.length} of ${maxPlayers} people max</div>
      <span>
      <button data-id="${targetServerId}" type="button" class="btn-full-width btn-control-xs rbx-game-server-join btn-primary-md btn-min-width">Join</button>
      </span>
      </div>
      <div class="section-right rbx-game-server-players">
      ${thumbnails.map(url => `<span class="avatar avatar-headshot-sm player-avatar"><span class="thumbnail-2d-container avatar-card-image"><img src="${url}"></span></span>`).join('')}
      </div>`;

      first.parentNode.insertBefore(item, first);
      highlighted.push(item);

      const [join] = document.querySelectorAll(`[data-id="${targetServerId}"]`);
      join.onclick = () => chrome.runtime.sendMessage({ message: { place, id: targetServerId } });
      status.innerText = 'Found target';
    }
  } else {
    color(canceled ? COLORS.BLUE : COLORS.RED);
    status.innerText = canceled ? 'Canceled search' : 'Target not found!';
  }

  searching = false;
  canceled = false;

  bar.style.width = '100%';
  input.disabled = false;
  search.src = getURL('images/search.png');
}

function renderServers() {
  for (const item of highlighted) {
    item.remove();
  }

  highlighted = [];

  for (const targetServerId of targetServersId) {
    icon.src = getURL('images/user-success.png');
    color(COLORS.GREEN);
    setTimeout(() => color(COLORS.BLUE), 1000);

    const first = document.querySelectorAll('.rbx-game-server-item')[0];
    const item = document.createElement('li');

    const thumbnails = allThumbnails.get(targetServerId);

    item.className = 'stack-row rbx-game-server-item highlighted';
    item.innerHTML = `
      <div class="section-left rbx-game-server-details'">
      <div class="text-info rbx-game-status rbx-game-server-status'">${thumbnails.length} of ${maxPlayers} people max</div>
      <span>
      <button data-id="${targetServerId}" type="button" class="btn-full-width btn-control-xs rbx-game-server-join btn-primary-md btn-min-width">Join</button>
      </span>
      </div>
      <div class="section-right rbx-game-server-players">
      ${thumbnails.map(url => `<span class="avatar avatar-headshot-sm player-avatar"><span class="thumbnail-2d-container avatar-card-image"><img src="${url}"></span></span>`).join('')}
      </div>`;

    first.parentNode.insertBefore(item, first);
    highlighted.push(item);

    const [join] = document.querySelectorAll(`[data-id="${targetServerId}"]`);
    join.onclick = () => chrome.runtime.sendMessage({ message: { place, id: targetServerId } });
    status.innerText = 'Found target';
  }
}

async function find(imageUrl, place) {
  allPlayers = [];
  targetServersId = [];

  allThumbnails.clear();
  foundAllServers = false;
  searchingTarget = true;
  allPlayers = [];
  playersCount = 0;
  targetsChecked = 0;
  maxPlayers = 0;

  status.innerText = 'Searching...';
  color(COLORS.BLUE);
  search.src = getURL('images/cancel.png');
  icon.src = getURL('images/user-success.png');
  input.disabled = true;

  fetchServers(place);
  findTarget(imageUrl, place);
}

search.addEventListener('click', async event => {
  event.preventDefault();

  if (searching) {
    canceled = true;
    return;
  }

  searching = true;

  const userResponse = await post('https://users.roblox.com/v1/usernames/users', JSON.stringify({
    usernames: [input.value],
    excludeBannedUsers: true
  }));

  const user = userResponse.data && userResponse.data[0];

  if (!user) {
    icon.src = USER.ERROR;
    searching = false;
    status.innerText = 'User not found!';
    return;
  }

  const placeMatch = window.location.href.match(/\/games\/(\d+)\//);
  const place = placeMatch ? placeMatch[1] : null;

  const thumbnail = await get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`);

  for (const item of highlighted) {
    item.remove();
  }

  find(thumbnail.data[0].imageUrl, place);


});
