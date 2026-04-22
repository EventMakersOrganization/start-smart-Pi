import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  OnInit,
  AfterViewInit,
} from '@angular/core';

@Component({
  selector: 'app-quiz-file-viewer',
  templateUrl: './quiz-file-viewer.component.html',
})
export class QuizFileViewerComponent implements OnInit, AfterViewInit {
  @Input() content: any;
  @Input() subjectTitle = '';
  @Input() chapterTitle = '';
  @Input() subChapterTitle = '';
  @Output() submitted = new EventEmitter<void>();

  @ViewChild('quizEditor') quizEditor!: ElementRef<HTMLDivElement>;

  activeTab: 'edit' | 'upload' | 'original' = 'edit';
  isDocx = false;
  isPdf = false;
  loading = false;
  htmlContent = '';
  originalHtml = '';
  comments: { text: string; id: string }[] = [];
  selectedFile: File | null = null;
  submitSuccess = false;
  submitError = '';

  ngOnInit() {
    this.isDocx = this.content.fileName?.toLowerCase().endsWith('.docx');
    this.isPdf = this.content.fileName?.toLowerCase().endsWith('.pdf');
    if (this.isDocx) {
      this.loadDocx();
    }
  }

  ngAfterViewInit() {
    // For DOCX, content will be loaded in loadDocx()
  }

  async loadDocx() {
    this.loading = true;
    // @ts-ignore
    const mammoth = await import('mammoth/mammoth.browser');
    const response = await fetch(this.content.url);
    const arrayBuffer = await response.arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer });
    this.htmlContent = value;
    this.originalHtml = value;
    this.loading = false;
    setTimeout(() => {
      if (this.quizEditor)
        this.quizEditor.nativeElement.innerHTML = this.htmlContent;
    });
  }

  setTab(tab: 'edit' | 'upload' | 'original') {
    this.activeTab = tab;
    if (tab === 'edit' && this.quizEditor && this.htmlContent) {
      this.quizEditor.nativeElement.innerHTML = this.htmlContent;
    }
    if (tab === 'original' && this.quizEditor && this.originalHtml) {
      this.quizEditor.nativeElement.innerHTML = this.originalHtml;
    }
  }

  execCommand(cmd: string) {
    document.execCommand(cmd, false);
  }

  highlightSelection() {
    this.wrapSelectionWithSpan('background:#fef08a');
  }

  addComment() {
    const note = prompt('Ajouter un commentaire :');
    if (!note) return;
    const id = 'comment-' + Date.now();
    this.wrapSelectionWithSpan(
      'background:#bfdbfe;border-bottom:2px solid #3b82f6',
      note,
      id,
    );
    this.comments.push({ text: note, id });
  }

  removeHighlights() {
    if (!this.quizEditor) return;
    const el = this.quizEditor.nativeElement;
    el.innerHTML = el.innerHTML
      .replace(/<span style="background:#fef08a">([\s\S]*?)<\/span>/g, '$1')
      .replace(
        /<span title=".*?" style="background:#bfdbfe;border-bottom:2px solid #3b82f6" id="comment-\d+">([\s\S]*?)<\/span>/g,
        '$1',
      );
    this.comments = [];
  }

  wrapSelectionWithSpan(style: string, title?: string, id?: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement('span');
    span.setAttribute('style', style);
    if (title) span.setAttribute('title', title);
    if (id) span.setAttribute('id', id);
    range.surroundContents(span);
    sel.removeAllRanges();
  }

  onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.selectedFile = input.files[0];
    }
  }

  async submit() {
  this.loading = true;
  this.submitError = '';

  try {
    const formData = new FormData();
    formData.append('quizId', this.content.contentId);
    formData.append('quizTitle', this.content.title);
    formData.append('subjectTitle', this.subjectTitle);
    formData.append('chapterTitle', this.chapterTitle);
    formData.append('subChapterTitle', this.subChapterTitle);

    if (this.activeTab === 'edit' && this.isDocx) {
      const html = this.quizEditor.nativeElement.innerHTML;
      const blob = new Blob([html], { type: 'text/html' });
      formData.append('file', blob, 'quiz-response.html');
    } else if (this.activeTab === 'upload' && this.selectedFile) {
      formData.append('file', this.selectedFile, this.selectedFile.name);
    } else {
      this.submitError = 'Aucun fichier sélectionné ou contenu vide.';
      this.loading = false;
      return;
    }

    // ✅ Récupère le token depuis toutes les sources possibles
    let token = '';

    // Essai 1 : clés directes
    const tokenKeys = [
      'access_token', 'token', 'jwt', 'authToken',
      'auth_token', 'accessToken', 'id_token'
    ];
    for (const key of tokenKeys) {
      const val = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (val && val.startsWith('eyJ')) { token = val; break; }
    }

    // Essai 2 : token imbriqué dans l'objet user
    if (!token) {
      for (const key of ['user', 'currentUser', 'auth', 'session']) {
        try {
          const obj = JSON.parse(localStorage.getItem(key) || '{}');
          const candidate =
            obj?.token || obj?.access_token || obj?.accessToken ||
            obj?.jwt || obj?.id_token || '';
          if (candidate && candidate.startsWith('eyJ')) {
            token = candidate;
            break;
          }
        } catch {}
      }
    }

    console.log('[QuizFileViewer] Token found:', token ? token.slice(0, 30) + '...' : 'NONE');

    if (!token) {
      this.submitError = 'Session expirée. Veuillez vous reconnecter.';
      this.loading = false;
      return;
    }

    // ✅ Endpoint correct (celui qui existe dans ton backend)
    const res = await fetch(
      'http://localhost:3000/api/subjects/quiz-file-submissions/submit',
      {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      let errMsg = `Erreur ${res.status}`;
      try {
        const body = await res.json();
        errMsg = body?.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    this.submitSuccess = true;
    this.submitted.emit();

  } catch (e: any) {
    this.submitError = e?.message || 'Erreur inconnue lors de la soumission.';
    console.error('[QuizFileViewer] Submit error:', e);
  }

  this.loading = false;
}
}
