import { Injectable } from '@angular/core';

export interface SpeechToTextHandlers {
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

@Injectable({ providedIn: 'root' })
export class SpeechToTextService {
  private recognition: { stop: () => void; start: () => void } | null = null;

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    );
  }

  start(handlers: SpeechToTextHandlers, lang?: string): void {
    const w = window as unknown as Record<string, unknown>;
    const SR = (w['SpeechRecognition'] || w['webkitSpeechRecognition']) as
      | (new () => Record<string, unknown>)
      | undefined;
    if (!SR) {
      handlers.onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    this.stop();

    const rec = new SR() as Record<string, unknown>;
    this.recognition = rec as { stop: () => void; start: () => void };
    rec['lang'] = lang || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    rec['continuous'] = false;
    rec['interimResults'] = true;

    rec['onresult'] = (ev: Record<string, unknown>) => {
      let interim = '';
      const resultIndex = ev['resultIndex'] as number;
      const results = ev['results'] as Array<{ isFinal: boolean; 0: { transcript: string } }>;
      for (let i = resultIndex; i < results.length; i++) {
        const tr = results[i][0].transcript;
        if (results[i].isFinal) {
          handlers.onResult(tr, true);
        } else {
          interim += tr;
        }
      }
      if (interim) {
        handlers.onResult(interim, false);
      }
    };

    rec['onerror'] = (ev: Record<string, unknown>) => {
      let msg = String(ev['message'] || ev['error'] || '');
      if (ev['error'] === 'not-allowed') {
        msg = 'Microphone access was denied. Allow the microphone in your browser settings.';
      } else if (ev['error'] === 'no-speech') {
        msg = 'No speech detected. Try again.';
      }
      handlers.onError?.(msg);
    };

    rec['onend'] = () => {
      handlers.onEnd?.();
    };

    try {
      (rec['start'] as () => void)();
    } catch (e) {
      handlers.onError?.('Could not start speech recognition.');
    }
  }

  stop(): void {
    try {
      this.recognition?.stop();
    } catch {
      /* ignore */
    }
    this.recognition = null;
  }
}
