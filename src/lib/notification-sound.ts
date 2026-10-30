/**
 * Small Web Audio chime used for in-app booking notifications.
 *
 * We deliberately avoid an audio dependency: a short two/three-note chime is
 * enough to catch attention and works offline. Browsers block audio until the
 * first user gesture, so the context is created lazily and resumed when needed.
 */
let audioContext: AudioContext | null = null;

export function playNotificationSound(kind: "farmer" | "owner" = "farmer") {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
    return;
  }
  try {
    audioContext ??= new window.AudioContext();
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
    // Owners get a brighter rising chime for new jobs; farmers get a softer one
    // for booking updates.
    const notes =
      kind === "owner" ? [659.25, 830.61, 987.77] : [523.25, 659.25, 783.99];
    const start = audioContext.currentTime + 0.02;
    notes.forEach((frequency, index) => {
      if (!audioContext) return;
      const at = start + index * 0.16;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.3);
    });
  } catch {
    // Audio is a progressive enhancement. Ignore unsupported or blocked audio.
  }
}
