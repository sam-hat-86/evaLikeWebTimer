/* ===================================
   EVANGELION TIMER - 共通タイマーロジック
   =================================== */

class TimerCore {
    constructor({ onTick, onFinish, onStart, onStop, onReset } = {}) {
        this.totalSeconds = 0;
        this.remainingSeconds = 0;
        this.intervalId = null;
        this.running = false;
        this.finished = false;
        this.onTick = onTick || (() => {});
        this.onFinish = onFinish || (() => {});
        this.onStart = onStart || (() => {});
        this.onStop = onStop || (() => {});
        this.onReset = onReset || (() => {});
    }

    setTime(hours, minutes, seconds) {
        this.totalSeconds = (parseInt(hours) || 0) * 3600
                          + (parseInt(minutes) || 0) * 60
                          + (parseInt(seconds) || 0);
        this.remainingSeconds = this.totalSeconds;
        this.finished = false;
    }

    start() {
        if (this.running || this.totalSeconds <= 0) return;
        this.running = true;
        this.finished = false;
        this.onStart();
        this.intervalId = setInterval(() => {
            this.remainingSeconds--;
            this.onTick(this.remainingSeconds, this.totalSeconds);
            if (this.remainingSeconds <= 0) {
                this.remainingSeconds = 0;
                this.stop();
                this.finished = true;
                this.onFinish();
            }
        }, 1000);
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.onStop();
    }

    reset() {
        this.stop();
        this.remainingSeconds = this.totalSeconds;
        this.finished = false;
        this.onReset();
        this.onTick(this.remainingSeconds, this.totalSeconds);
    }

    getProgress() {
        if (this.totalSeconds === 0) return 100;
        return (this.remainingSeconds / this.totalSeconds) * 100;
    }
}

/* --- 時刻フォーマット --- */
function formatTime(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTimeAlwaysFull(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* --- サウンド管理 --- */
class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.muted = false;
        this.soundType = 'pi';       // 'pi' | 'pipi' | 'pii' | 'custom'
        this.customAudioUrl = null;   // Data URL of uploaded file
    }

    _getCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioCtx;
    }

    _beep(frequency, duration, type = 'sine', volume = 0.6) {
        const ctx = this._getCtx();
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, t);
        // 音量を維持してから末尾でフェードアウト
        const fadeStart = Math.max(t, t + duration - 0.05);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.setValueAtTime(volume, fadeStart);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration);
    }

    /* ぴ — 短い単音 */
    _playPi() {
        this._beep(1000, 0.2);
    }

    /* ぴぴ — 短い二連音 */
    _playPiPi() {
        this._beep(1000, 0.15);
        setTimeout(() => this._beep(1000, 0.15), 250);
    }

    /* ぴー — 長い持続音 */
    _playPii() {
        this._beep(880, 1.0);
    }

    /* 独自音声ファイル再生 */
    _playCustom() {
        if (!this.customAudioUrl) return;
        const audio = new Audio(this.customAudioUrl);
        audio.volume = 0.5;
        audio.play().catch(() => {});
    }

    /* 終了音を鳴らす */
    playAlarm() {
        if (this.muted) return;
        switch (this.soundType) {
            case 'pi':     this._playPi(); break;
            case 'pipi':   this._playPiPi(); break;
            case 'pii':    this._playPii(); break;
            case 'custom': this._playCustom(); break;
            default:       this._playPi();
        }
    }

    /* 音声ファイル読込 */
    loadCustomFile(file) {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'wav' && ext !== 'mp3') return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.customAudioUrl = e.target.result;
            this.soundType = 'custom';
        };
        reader.readAsDataURL(file);
    }

    setSoundType(type) {
        this.soundType = type;
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    /* 試聴用 */
    preview() {
        const wasMuted = this.muted;
        this.muted = false;
        this.playAlarm();
        this.muted = wasMuted;
    }
}

/* --- ユーティリティ --- */
function generateId() {
    return 'timer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

function updateTimerDisplayClass(displayEl, remaining, total) {
    displayEl.classList.remove('warning', 'danger', 'finished');
    if (remaining <= 0) {
        displayEl.classList.add('finished');
    } else if (total > 0 && remaining / total <= 0.1) {
        displayEl.classList.add('danger');
    } else if (total > 0 && remaining / total <= 0.25) {
        displayEl.classList.add('warning');
    }
}

function updateProgressBar(barEl, remaining, total) {
    const pct = total > 0 ? (remaining / total) * 100 : 100;
    barEl.style.width = pct + '%';
    barEl.classList.remove('warning', 'danger');
    if (total > 0 && remaining / total <= 0.1) {
        barEl.classList.add('danger');
    } else if (total > 0 && remaining / total <= 0.25) {
        barEl.classList.add('warning');
    }
}

function getCurrentTimeString() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

/* --- 現在時刻表示 --- */
function startClock(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const update = () => { el.textContent = getCurrentTimeString(); };
    update();
    setInterval(update, 1000);
}