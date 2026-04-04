import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class AudioService {
    private music: HTMLAudioElement | null = null;
    private sfxEnabled = true;
    private musicEnabled = true;

    private sounds = {
        click: 'https://assets.mixkit.co/sfx/preview/mixkit-light-button-click-1182.mp3',
        correct: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-reward-952.mp3',
        wrong: 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3',
        join: 'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-back-button-2566.mp3',
        start: 'https://assets.mixkit.co/sfx/preview/mixkit-adventure-game-jump-icon-3029.mp3',
        victory: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
        powerup: 'https://assets.mixkit.co/sfx/preview/mixkit-magic-marimba-notif-2365.mp3'
    };

    private musicTracks = {
        lobby: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
        game: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3'
    };

    playSFX(key: keyof typeof this.sounds) {
        if (!this.sfxEnabled) return;
        const audio = new Audio(this.sounds[key]);
        audio.volume = 0.5;
        audio.play().catch(() => { }); // Browser might block autoplay
    }

    startMusic(track: keyof typeof this.musicTracks) {
        if (!this.musicEnabled) return;
        this.stopMusic();
        this.music = new Audio(this.musicTracks[track]);
        this.music.loop = true;
        this.music.volume = 0.3;
        this.music.play().catch(() => {
            console.warn('Music playback failed (user interaction required)');
        });
    }

    stopMusic() {
        if (this.music) {
            this.music.pause();
            this.music = null;
        }
    }

    toggleSFX() { this.sfxEnabled = !this.sfxEnabled; }
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (!this.musicEnabled) this.stopMusic();
    }

    get isMusicEnabled() { return this.musicEnabled; }
    get isSFXEnabled() { return this.sfxEnabled; }
}
