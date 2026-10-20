export function createAmbientSound() {
  let context, wind, windGain, rainGain, birdsTimer;
  let environment = { rain: 0, wind: 0.4, daylight: 1, sheltered: false };
  let playing = false;
  function bird() {
    if (!playing || environment.daylight < 0.3 || environment.rain > 0.35) return;
    const now = context.currentTime;
    for (let i = 0; i < 3; i++) {
      const tone = context.createOscillator();
      const gain = context.createGain();
      tone.type = 'sine';
      const start = now + i * .23;
      tone.frequency.setValueAtTime(2300 + Math.random() * 650, start);
      tone.frequency.exponentialRampToValueAtTime(3600 + Math.random() * 500, start + .09);
      tone.frequency.exponentialRampToValueAtTime(2500, start + .18);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.014, start + .03);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .18);
      tone.connect(gain); gain.connect(context.destination);
      tone.start(start); tone.stop(start + .2);
    }
  }
  async function toggle() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      // 轻柔的低频风声与间歇鸟鸣全部本地合成。
      const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * .018) / 1.018;
        data[i] = previous * 3;
      }
      wind = context.createBufferSource(); wind.buffer = buffer; wind.loop = true;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 540;
      windGain = context.createGain(); windGain.gain.value = .22;
      wind.connect(filter); filter.connect(windGain); windGain.connect(context.destination); wind.start();
      const rainBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const rainData = rainBuffer.getChannelData(0);
      for (let i = 0; i < rainData.length; i++) rainData[i] = Math.random() * 2 - 1;
      const rain = context.createBufferSource(); rain.buffer = rainBuffer; rain.loop = true;
      const rainFilter = context.createBiquadFilter(); rainFilter.type = 'bandpass'; rainFilter.frequency.value = 1700; rainFilter.Q.value = 0.45;
      rainGain = context.createGain(); rainGain.gain.value = 0;
      rain.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(context.destination); rain.start();
      setEnvironment(environment);
    }
    playing = !playing;
    if (playing) {
      await context.resume();
      bird();
      birdsTimer = window.setInterval(bird, 11000);
    } else {
      window.clearInterval(birdsTimer);
      await context.suspend();
    }
    return playing;
  }
  function setEnvironment(value) {
    environment = value;
    if (!context) return;
    const shelter = environment.sheltered ? 0.3 : 1;
    windGain.gain.setTargetAtTime((0.17 + environment.wind * 0.045) * shelter, context.currentTime, 0.6);
    rainGain.gain.setTargetAtTime(environment.rain * 0.095 * shelter, context.currentTime, 0.6);
  }
  return { toggle, setEnvironment };
}
