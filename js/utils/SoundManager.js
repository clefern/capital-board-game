/**
 * SoundManager - Procedural game sound effects using Web Audio API.
 * No external audio files required.
 */
export class SoundManager {
  constructor() {
    this._volume = 0.5;
    this._muted = false;
    this._ctx = null;
  }

  /** Lazily initialise AudioContext (must happen after user gesture). */
  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  }

  // ── Volume / mute ──────────────────────────────────────────────

  get volume() { return this._volume; }
  set volume(v) { this._volume = Math.max(0, Math.min(1, v)); }

  get muted() { return this._muted; }
  set muted(v) { this._muted = !!v; }

  /** Effective gain multiplier. */
  _gain() { return this._muted ? 0 : this._volume; }

  // ── Low-level helpers ──────────────────────────────────────────

  _osc(type, freq, startTime, duration, gainValue, destination) {
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainValue * this._gain(), startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(destination || ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
    return { osc, gain };
  }

  _noise(startTime, duration, gainValue) {
    const ctx = this._getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue * this._gain(), startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(startTime);
    src.stop(startTime + duration);
    return { src, gain };
  }

  // ── Sound effects ──────────────────────────────────────────────

  /** Dice rolling / shaking: rapid noise bursts. */
  playDiceRoll() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      this._noise(now + i * 0.04, 0.03, 0.15 + Math.random() * 0.1);
    }
  }

  /** Dice result: a satisfying low "thunk". */
  playDiceResult() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._osc('sine', 150, now, 0.15, 0.4);
    this._noise(now, 0.08, 0.25);
  }

  /** Pawn step: light tap. */
  playPawnMove() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._osc('sine', 600, now, 0.06, 0.2);
    this._noise(now, 0.03, 0.08);
  }

  /** Pawn landing: heavier thud. */
  playPawnLand() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._osc('sine', 200, now, 0.18, 0.35);
    this._noise(now, 0.06, 0.15);
  }

  /** Coins: metallic clinks. */
  playCoins() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const freqs = [2400, 3200, 2800, 3600];
    freqs.forEach((f, i) => {
      this._osc('sine', f, now + i * 0.07, 0.1, 0.12);
      this._osc('square', f * 1.5, now + i * 0.07, 0.05, 0.04);
    });
  }

  /** Payment: descending tone. */
  playPayment() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    gain.gain.setValueAtTime(0.25 * this._gain(), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  /** Card play: whoosh / flip. */
  playCardPlay() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Filtered noise whoosh
    const bufLen = ctx.sampleRate * 0.15;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(1000, now);
    bpf.frequency.exponentialRampToValueAtTime(4000, now + 0.1);
    bpf.Q.value = 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3 * this._gain(), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(bpf);
    bpf.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.15);
  }

  /** Build: hammer strike. */
  playBuild() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.15;
      this._noise(t, 0.05, 0.2);
      this._osc('sine', 180 - i * 20, t, 0.1, 0.25);
    }
  }

  /** Level up: ascending triumphant chime. */
  playLevelUp() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      this._osc('sine', f, now + i * 0.1, 0.25, 0.2);
      this._osc('triangle', f * 2, now + i * 0.1, 0.15, 0.06);
    });
  }

  /** Bifurcation: attention chime (two quick notes). */
  playBifurcation() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._osc('sine', 880, now, 0.12, 0.2);
    this._osc('sine', 1100, now + 0.12, 0.15, 0.2);
    this._osc('triangle', 880, now, 0.08, 0.08);
  }

  /** Minigame start: exciting ascending jingle. */
  playMinigameStart() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const notes = [392, 494, 587, 659, 784]; // G4 B4 D5 E5 G5
    notes.forEach((f, i) => {
      this._osc('square', f, now + i * 0.08, 0.15, 0.1);
      this._osc('sine', f, now + i * 0.08, 0.2, 0.15);
    });
  }

  /** Minigame end: short fanfare. */
  playMinigameEnd() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const t = now + i * 0.12;
      this._osc('sine', f, t, 0.3, 0.18);
      this._osc('triangle', f, t, 0.2, 0.08);
    });
    // Final sustain
    this._osc('sine', 1047, now + 0.48, 0.5, 0.2);
  }

  /** Stock up: quick ascending happy tone. */
  playStockUp() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._osc('sine', 440, now, 0.12, 0.2);
    this._osc('sine', 554, now + 0.08, 0.12, 0.2);
    this._osc('sine', 660, now + 0.16, 0.18, 0.25);
  }

  /** Stock down: quick descending sad tone. */
  playStockDown() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._osc('sine', 440, now, 0.12, 0.2);
    this._osc('sine', 370, now + 0.08, 0.12, 0.2);
    this._osc('sine', 311, now + 0.16, 0.2, 0.2);
  }

  /** Victory: triumphant multi-note fanfare. */
  playVictory() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    // Fanfare: C E G C' (octave) held with harmonics
    const melody = [
      { f: 523, t: 0,    d: 0.2 },
      { f: 659, t: 0.15, d: 0.2 },
      { f: 784, t: 0.3,  d: 0.2 },
      { f: 1047,t: 0.45, d: 0.6 },
    ];
    melody.forEach(({ f, t, d }) => {
      this._osc('sine', f, now + t, d, 0.2);
      this._osc('triangle', f * 2, now + t, d * 0.7, 0.06);
    });
    // Shimmering high note at the end
    this._osc('sine', 1568, now + 0.55, 0.5, 0.1);
    this._osc('sine', 2093, now + 0.6, 0.45, 0.06);
  }

  /** Bankruptcy: sad descending minor chord. */
  playBankruptcy() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    const notes = [440, 370, 311, 261]; // A4 F#4 Eb4 C4
    notes.forEach((f, i) => {
      const t = now + i * 0.2;
      this._osc('sine', f, t, 0.35, 0.2);
      this._osc('triangle', f * 0.5, t, 0.3, 0.08);
    });
  }

  /** Button click: subtle short click. */
  playButtonClick() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._osc('sine', 1000, now, 0.04, 0.15);
  }

  /** Turn start: gentle two-note notification. */
  playTurnStart() {
    const ctx = this._getCtx();
    const now = ctx.currentTime;
    this._osc('sine', 660, now, 0.12, 0.15);
    this._osc('sine', 880, now + 0.1, 0.15, 0.18);
    this._osc('triangle', 880, now + 0.1, 0.1, 0.05);
  }

  // ── Background Music (procedural lo-fi) ────────────────────

  _musicPlaying = false;
  _musicGain = null;
  _musicTimer = null;

  startMusic() {
    if (this._musicPlaying) return;
    this._musicPlaying = true;
    const ctx = this._getCtx();

    this._musicGain = ctx.createGain();
    this._musicGain.gain.setValueAtTime(0, ctx.currentTime);
    this._musicGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
    this._musicGain.connect(ctx.destination);

    this._playMusicLoop();
  }

  stopMusic() {
    if (!this._musicPlaying) return;
    this._musicPlaying = false;
    if (this._musicTimer) clearTimeout(this._musicTimer);
    if (this._musicGain) {
      const ctx = this._getCtx();
      this._musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    }
  }

  _playMusicLoop() {
    if (!this._musicPlaying) return;
    const ctx = this._getCtx();
    const now = ctx.currentTime;

    // Chord progression: C Am F G (lo-fi style)
    const chords = [
      [261, 329, 392],  // C major
      [220, 261, 329],  // A minor
      [174, 220, 261],  // F major
      [196, 246, 294],  // G major
    ];

    const chordDuration = 2.0;
    const totalDuration = chords.length * chordDuration;

    chords.forEach((chord, ci) => {
      const t = now + ci * chordDuration;
      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        const vol = this._muted ? 0 : 0.06;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.3);
        gain.gain.setValueAtTime(vol, t + chordDuration - 0.5);
        gain.gain.linearRampToValueAtTime(0, t + chordDuration);

        osc.connect(gain);
        gain.connect(this._musicGain);
        osc.start(t);
        osc.stop(t + chordDuration);
      });
    });

    this._musicTimer = setTimeout(() => this._playMusicLoop(), totalDuration * 1000);
  }
}

/** Singleton instance. */
export const soundManager = new SoundManager();
