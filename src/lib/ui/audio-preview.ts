/* Zentrale Audio-Preview-Logik für die Settings-UI.
   - Einheitliche Lautstärke-Umrechnung dB → linear
   - Nur eine Preview gleichzeitig: ein neuer Play stoppt die alte Instanz,
     damit der User nicht mehrere überlappende Sounds bekommt. */

let current: HTMLAudioElement | null = null;

export function previewAudio(url: string | null | undefined, volumeDb: number) {
  if (!url) return;
  if (current) {
    current.pause();
    current.currentTime = 0;
  }
  const a = new Audio(url);
  a.volume = Math.max(0, Math.min(1, Math.pow(10, volumeDb / 20)));
  current = a;
  a.play().catch((err) => console.warn("preview audio failed", err));
}

export function stopPreview() {
  if (current) {
    current.pause();
    current = null;
  }
}
