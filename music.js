// Background music + the one-time "San Francisco" popup.
// Loaded with <script src="music.js" defer>; it needs #music, #music-label and #song from index.html.

// Seconds into music/song.mp3 at which "San Francisco" is sung in the first line
// ("I lost my head in San Francisco"). The clip starts at 1:00 in the original song and
// "San" lands at about 64.45s there, so 4.4s here. Raise it if the popup feels early.
const LYRIC_AT = 4.4;

(() => {
  const SHOW_FOR = 6000;   // ms the popup stays up
  const VOLUME = 0.45;

  const song = document.getElementById('song');
  let music = document.getElementById('music');
  if (!song || !music) return;

  // Swap in a clean copy of the button so any old inline click handler can't double-toggle.
  const fresh = music.cloneNode(true);
  music.replaceWith(fresh);
  music = fresh;
  const label = music.querySelector('#music-label');

  song.volume = VOLUME;

  // Only show the button once the file is actually there.
  fetch(song.getAttribute('src'), { method: 'HEAD' })
    .then(r => { if (r.ok) music.hidden = false; })
    .catch(() => {});

  const setPlaying = on => {
    music.classList.toggle('playing', on);
    music.setAttribute('aria-pressed', String(on));
    if (label) label.textContent = on ? 'Pause music' : 'Play music';
  };

  // ---------- The popup ----------
  const bridge = `
    <svg class="sf-pop__art" viewBox="-30 -4 300 76" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <circle class="sf-pop__sun" cx="186" cy="50" r="15"/>
      <g class="sf-pop__bridge">
        <path class="sf-pop__cable" d="M-30 41 L0 40 Q36 36 62 12 Q120 52 178 12 Q204 36 240 40 L270 41"/>
        <path class="sf-pop__hangers" d="M76 21v23M90 27v17M104 31v13M118 32v12M132 31v13M146 28v16M160 22.5v21.5M20 36v8M40 28v16M200 28v16M220 36v8"/>
        <path class="sf-pop__deck" d="M-30 44H270"/>
        <path class="sf-pop__tower" d="M58 64V10h8v54M174 64V10h8v54M58 22h8M58 34h8M174 22h8M174 34h8"/>
      </g>
      <path class="sf-pop__water" d="M-30 58q15-3 30 0t30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0 30 0V72H-30z"/>
      <g class="sf-pop__fog">
        <ellipse cx="10" cy="50" rx="62" ry="9"/>
        <ellipse cx="130" cy="54" rx="64" ry="8"/>
        <ellipse cx="240" cy="49" rx="60" ry="9"/>
      </g>
    </svg>`;

  const pop = document.createElement('div');
  pop.className = 'sf-pop';
  pop.setAttribute('role', 'status');
  pop.setAttribute('aria-live', 'polite');
  pop.hidden = true;
  document.body.appendChild(pop);

  let hideTimer = 0, outTimer = 0, shown = false;

  const hidePopup = () => {
    clearTimeout(hideTimer);
    if (pop.hidden) return;
    pop.classList.remove('is-in');
    pop.classList.add('is-out');
    clearTimeout(outTimer);
    outTimer = setTimeout(() => { pop.hidden = true; pop.classList.remove('is-out'); pop.innerHTML = ''; }, 320);
  };

  const armHide = ms => { clearTimeout(hideTimer); hideTimer = setTimeout(hidePopup, ms); };

  const showPopup = ({ stay = false } = {}) => {
    shown = true;
    clearTimeout(outTimer);
    pop.classList.remove('is-out');
    pop.hidden = false;
    // Filled in after the live region exists, so screen readers announce it.
    pop.innerHTML = `
      <div class="sf-pop__card">
        ${bridge}
        <p class="sf-pop__text"><span class="sf-pop__kicker">Get it?</span> Because you're from San&nbsp;Francisco.</p>
        <button class="sf-pop__close" type="button" aria-label="Dismiss">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>`;
    pop.querySelector('.sf-pop__close').addEventListener('click', hidePopup);
    void pop.offsetWidth;            // restart the entrance animation
    pop.classList.add('is-in');
    if (!stay) armHide(SHOW_FOR);
  };

  // Don't yank it away while someone is reading or tabbing to the close button.
  pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  pop.addEventListener('focusin', () => clearTimeout(hideTimer));
  pop.addEventListener('mouseleave', () => { if (!pop.hidden && !pop.contains(document.activeElement)) armHide(2500); });
  pop.addEventListener('focusout', e => { if (!pop.contains(e.relatedTarget)) armHide(2500); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePopup(); });

  // ---------- Lyric cue: a timer for precision, timeupdate as the backup ----------
  let cueTimer = 0;
  const clearCue = () => { clearTimeout(cueTimer); cueTimer = 0; };
  const fireCue = () => {
    clearCue();
    if (shown || song.paused) return;
    // Audio can start a beat behind the wall clock; if we're early, wait out the difference.
    if (song.currentTime < LYRIC_AT - 0.05) return armCue();
    showPopup();
  };
  const armCue = () => {
    clearCue();
    if (shown) return;
    const wait = (LYRIC_AT - song.currentTime) / (song.playbackRate || 1);
    if (wait >= 0) cueTimer = setTimeout(fireCue, wait * 1000);
  };

  song.addEventListener('playing', armCue);
  song.addEventListener('pause', clearCue);
  song.addEventListener('seeked', () => { if (!song.paused) armCue(); });
  song.addEventListener('timeupdate', () => {
    // Only within a short window after the cue, so a late first update or a loop can't fire it.
    if (!shown && song.currentTime >= LYRIC_AT && song.currentTime < LYRIC_AT + 2) fireCue();
  });

  // ---------- Button ----------
  music.addEventListener('click', async () => {
    if (song.paused) {
      try { await song.play(); } catch { return; }
      setPlaying(true);
    } else {
      song.pause();
      setPlaying(false);
    }
  });
  song.addEventListener('pause', () => setPlaying(false));
  song.addEventListener('play', () => setPlaying(true));

  // Test hooks: window.firstdateMusic.showPopup(), or open the page with ?popup.
  window.firstdateMusic = { LYRIC_AT, showPopup, hidePopup };
  if (new URLSearchParams(location.search).has('popup')) {
    music.hidden = false;
    showPopup({ stay: true });
  }
})();
