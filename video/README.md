# Walkthrough source

- `lines.txt`: narration, one line per segment (`id|text`).
- `record.mjs`: Playwright drives the production build (`npm run build && npm run preview`), with a visible cursor and a small corner marker that changes colour at each segment start.
- Narration: Piper text-to-speech, stock open voice `en_GB-alba-medium` (no voice cloning), one WAV per line in `video/out/vo/`.
- Assembly (ffmpeg): the marker is located in the raw capture, each segment is retimed to match its measured wall-clock length (the screencast runs about 10% long), the marker is painted over, captions from `walkthrough.srt` are burned in, and the narration is placed at the recorded segment start times.
- Output: `public/walkthrough/walkthrough.mp4` (1366×768, H.264 + AAC, 87.3 s) and `walkthrough.vtt`.
