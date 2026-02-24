import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BrainrushService } from '../services/brainrush.service';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.css']
})
export class LobbyComponent {
  selectedMode: 'solo' | 'team' | null = null;
  selectedDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive' = 'medium';
  selectedTopic: string = 'Data Structures';
  roomCode: string = '';
  recentRooms: string[] = ['ABC123', 'XYZ789']; // Mock data

  topics = [
    { name: 'Data Structures', recommended: true, description: 'Based on your learning gaps' },
    { name: 'Algorithms', recommended: false, description: 'Fundamental algorithms' },
    { name: 'Object-Oriented Programming', recommended: true, description: 'OOP principles' },
    { name: 'Databases', recommended: false, description: 'Database management' },
    { name: 'Web Development', recommended: false, description: 'Web technologies' }
  ];

  constructor(private brainrushService: BrainrushService, private router: Router) {}

  selectMode(mode: 'solo' | 'team') {
    this.selectedMode = mode;
  }

  selectDifficulty(difficulty: 'easy' | 'medium' | 'hard' | 'adaptive') {
    this.selectedDifficulty = difficulty;
  }

  selectTopic(topic: string) {
    this.selectedTopic = topic;
  }

  startSolo() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Please login first');
      return;
    }
    const difficulty = this.selectedDifficulty === 'adaptive' ? 'medium' : this.selectedDifficulty;
    this.brainrushService.startSoloGame(difficulty as 'easy' | 'medium' | 'hard').subscribe({
      next: (response) => {
        console.log('Start solo response:', response);
        localStorage.setItem('firstQuestion', JSON.stringify(response.firstQuestion));
        this.router.navigate(['/brainrush/game', response.gameSessionId]);
      },
      error: (error) => {
        console.error('Start solo error:', error);
        alert('Failed to start game: ' + error.message);
      }
    });
  }

  createRoom() {
    const code = this.generateRoomCode();
    // Navigate to game with parameters
    this.router.navigate(['/brainrush/game', 'team'], {
      queryParams: { room: code, difficulty: this.selectedDifficulty, topic: this.selectedTopic }
    });
  }

  joinRoom() {
    if (this.roomCode.length === 6) {
      // Navigate to game with join parameter
      this.router.navigate(['/brainrush/game', 'team'], {
        queryParams: { room: this.roomCode, join: true }
      });
    }
  }

  fillRoomCode(code: string) {
    this.roomCode = code;
  }

  goBack() {
    this.router.navigate(['/student-dashboard']);
  }

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
