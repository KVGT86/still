type Sound = "move" | "activate" | "back";

let context: AudioContext | undefined;

function thock(kind: Sound) {
  const Audio = window.AudioContext || (window as any).webkitAudioContext;
  if (!Audio) return;
  context ||= new Audio();
  const ctx = context;
  const [start, end, duration, level] =
    kind === "move"
      ? [180, 105, 0.045, 0.018]
      : kind === "back"
        ? [105, 48, 0.07, 0.028]
        : [135, 58, 0.085, 0.04];
  const now = ctx.currentTime;
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(start, now);
  body.frequency.exponentialRampToValueAtTime(end, now + duration);
  bodyGain.gain.setValueAtTime(level, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  body.connect(bodyGain).connect(ctx.destination);
  body.start(now);
  body.stop(now + duration);

  const frames = Math.ceil(ctx.sampleRate * 0.012);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const noise = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++)
    noise[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const attack = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const attackGain = ctx.createGain();
  attack.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = kind === "move" ? 900 : 650;
  attackGain.gain.value = kind === "move" ? 0.006 : 0.01;
  attack.connect(filter).connect(attackGain).connect(ctx.destination);
  attack.start(now);
}

export function playInterfaceSound(kind: Sound) {
  const Audio = window.AudioContext || (window as any).webkitAudioContext;
  if (!Audio) return;
  context ||= new Audio();
  if (context.state === "suspended") void context.resume().then(() => thock(kind));
  else thock(kind);
}
