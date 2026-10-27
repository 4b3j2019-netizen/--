const countdown = document.getElementById("倒數");
const nextShow = new Date("2026-11-14T19:30:00+08:00").getTime();

function updateCountdown() {
  if (!countdown) return;

  const remaining = nextShow - Date.now();
  if (remaining <= 0) {
    countdown.textContent = "巡演已經啟程，現場見！";
    return;
  }

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  countdown.textContent = `還有 ${days} 天 ${hours} 小時 ${minutes} 分`;
}

updateCountdown();
window.setInterval(updateCountdown, 60_000);

const playButton = document.getElementById("播放按鈕");
const playIcon = playButton?.querySelector(".play-icon");
const seekBar = document.getElementById("播放進度");
const currentTimeLabel = document.getElementById("目前時間");
const durationLabel = document.getElementById("總時間");
const playbackStatus = document.getElementById("播放狀態");
const trackDuration = 18;

let audioContext;
let previewBuffer;
let currentSource;
let playbackPosition = 0;
let startedAt = 0;
let isPlaying = false;
let animationFrame;

function formatTime(seconds) {
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function setPlaybackButton(playing) {
  if (!playButton || !playIcon) return;

  playButton.classList.toggle("is-playing", playing);
  playButton.setAttribute("aria-label", playing ? "暫停新曲試聽" : "播放新曲試聽");
  playButton.setAttribute("aria-pressed", String(playing));
  playIcon.textContent = playing ? "Ⅱ" : "▶";
  if (playbackStatus) playbackStatus.textContent = playing ? "正在播放" : "已暫停";
}

function createPreviewBuffer(context) {
  const sampleRate = context.sampleRate;
  const frameCount = Math.ceil(sampleRate * trackDuration);
  const buffer = context.createBuffer(2, frameCount, sampleRate);
  const melody = [
    392, 440, 523.25, 587.33, 523.25, 440, 392, 329.63,
    349.23, 392, 440, 523.25, 440, 392, 349.23, 293.66,
    329.63, 392, 440, 493.88, 523.25, 493.88, 440, 392
  ];
  const beatLength = trackDuration / melody.length;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / sampleRate;
    const beat = Math.floor(time / beatLength);
    const withinBeat = time - beat * beatLength;
    const noteLength = beatLength * 0.82;
    const envelope = withinBeat < noteLength
      ? Math.min(withinBeat / 0.035, 1) * Math.min((noteLength - withinBeat) / 0.11, 1)
      : 0;
    const frequency = melody[beat];
    const melodyWave = envelope * (
      Math.sin(2 * Math.PI * frequency * time) * 0.16
      + Math.sin(2 * Math.PI * frequency * 2 * time) * 0.035
      + Math.sin(2 * Math.PI * frequency * 3 * time) * 0.012
    );
    const bassFrequency = melody[Math.floor(beat / 3) * 3] / 2;
    const bassEnvelope = Math.min(withinBeat / 0.08, 1) * Math.min((beatLength - withinBeat) / 0.15, 1);
    const bassWave = Math.sin(2 * Math.PI * bassFrequency * time) * bassEnvelope * 0.075;
    const padWave = Math.sin(2 * Math.PI * (frequency / 2) * time) * 0.025;
    const sample = melodyWave + bassWave + padWave;
    buffer.getChannelData(0)[frame] = sample;
    buffer.getChannelData(1)[frame] = sample;
  }

  return buffer;
}

function updateProgress() {
  if (!isPlaying || !seekBar) return;

  playbackPosition = Math.min(audioContext.currentTime - startedAt, trackDuration);
  seekBar.value = String((playbackPosition / trackDuration) * 100);
  if (currentTimeLabel) currentTimeLabel.textContent = formatTime(playbackPosition);
  animationFrame = window.requestAnimationFrame(updateProgress);
}

function pausePreview() {
  if (!isPlaying) return;

  playbackPosition = Math.min(audioContext.currentTime - startedAt, trackDuration);
  isPlaying = false;
  window.cancelAnimationFrame(animationFrame);
  if (currentSource) {
    currentSource.onended = null;
    currentSource.stop();
    currentSource = null;
  }
  setPlaybackButton(false);
  if (playbackStatus) playbackStatus.textContent = "已暫停";
}

async function startPreview() {
  if (!window.AudioContext && !window.webkitAudioContext) {
    if (playbackStatus) playbackStatus.textContent = "此瀏覽器不支援音訊播放";
    return;
  }

  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === "suspended") await audioContext.resume();
    previewBuffer ??= createPreviewBuffer(audioContext);

    if (playbackPosition >= trackDuration) playbackPosition = 0;

    const source = audioContext.createBufferSource();
    source.buffer = previewBuffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      if (currentSource !== source || !isPlaying) return;
      isPlaying = false;
      playbackPosition = 0;
      currentSource = null;
      window.cancelAnimationFrame(animationFrame);
      if (seekBar) seekBar.value = "0";
      if (currentTimeLabel) currentTimeLabel.textContent = "0:00";
      setPlaybackButton(false);
      if (playbackStatus) playbackStatus.textContent = "播放完成";
    };

    currentSource = source;
    startedAt = audioContext.currentTime - playbackPosition;
    isPlaying = true;
    source.start(0, playbackPosition);
    setPlaybackButton(true);
    updateProgress();
  } catch (error) {
    console.error("無法播放新曲試聽：", error);
    if (playbackStatus) playbackStatus.textContent = "音訊播放失敗，請再試一次";
    setPlaybackButton(false);
  }
}

if (durationLabel) durationLabel.textContent = formatTime(trackDuration);

playButton?.addEventListener("click", () => {
  if (isPlaying) {
    pausePreview();
    return;
  }

  void startPreview();
});

seekBar?.addEventListener("input", () => {
  playbackPosition = (Number(seekBar.value) / 100) * trackDuration;
  if (currentTimeLabel) currentTimeLabel.textContent = formatTime(playbackPosition);
  if (isPlaying) {
    pausePreview();
    void startPreview();
  }
});