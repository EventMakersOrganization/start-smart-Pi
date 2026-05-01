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
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-quiz-file-viewer',
  templateUrl: './quiz-file-viewer.component.html',
})
export class QuizFileViewerComponent implements OnInit, AfterViewInit {
  @Input() content: any;
  @Input() subjectTitle = '';
  @Input() chapterTitle = '';
  @Input() subChapterTitle = '';
  @Input() existingSubmission: any;
  @Output() submitted = new EventEmitter<any>();

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
  alreadySubmitted = false;
  showIframeFallback = false;
  submissionHtml: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.isDocx = this.content.fileName?.toLowerCase().endsWith('.docx');
    this.isPdf = this.content.fileName?.toLowerCase().endsWith('.pdf');
    
    if (this.existingSubmission) {
      this.alreadySubmitted = true;
      this.submitSuccess = true;
      this.activeTab = 'upload'; // Show the submitted file/info
      // Trigger preview for both HTML and potential HTML-wrapped DOC files
      this.loadSubmissionPreview();
    }

    if (this.isDocx && !this.alreadySubmitted) {
      this.loadDocx();
    }
  }

  async loadSubmissionPreview() {
    if (!this.existingSubmission?.fileUrl) {
      console.warn('[QuizFileViewer] No submission URL found');
      return;
    }
    
    console.log('[QuizFileViewer] Loading submission preview from:', this.existingSubmission.fileUrl);
    
    try {
      const url = this.existingSubmission.fileUrl;
      const isPotentialHtml = url.toLowerCase().endsWith('.html') || url.toLowerCase().endsWith('.doc');
      
      if (isPotentialHtml) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const text = await response.text();
        const trimmedText = text.trim().toLowerCase();
        
        // Defensive check: render if it contains common HTML tags
        if (trimmedText.startsWith('<html') || trimmedText.startsWith('<!doctype') || text.includes('<body') || text.includes('</div>')) {
          this.submissionHtml = this.sanitizer.bypassSecurityTrustHtml(text);
          console.log('[QuizFileViewer] HTML submission content loaded and sanitized');
        } else {
          console.log('[QuizFileViewer] Content does not look like HTML, falling back to iframe');
          this.showIframeFallback = true;
        }
      } else {
        this.showIframeFallback = true;
      }
    } catch (err) {
      console.error('[QuizFileViewer] Failed to load submission preview via fetch:', err);
      this.showIframeFallback = true;
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
      // Convert HTML to a format Word can open directly (.doc via HTML wrapping)
      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Quiz Response</title></head><body>`;
      const footer = `</body></html>`;
      const fullHtml = header + html + footer;
      const blob = new Blob([fullHtml], { type: 'application/msword' });
      formData.append('file', blob, 'quiz-response.doc');
    } else if (this.activeTab === 'upload' && this.selectedFile) {
      formData.append('file', this.selectedFile, this.selectedFile.name);
    } else {
      this.submitError = 'Aucun fichier sélectionné ou contenu vide.';
      this.loading = false;
      return;
    }

    // ✅ Improved Token Retrieval
    let token = '';
    const keys = ['authToken', 'access_token', 'token', 'jwt'];
    
    for (const key of keys) {
      const val = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (val) {
        token = val;
        break;
      }
    }

    if (!token) {
      // Try nested in user object
      try {
        const user = JSON.parse(localStorage.getItem('authUser') || '{}');
        token = user.token || user.accessToken || '';
      } catch {}
    }

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

    const responseData = await res.json();
    this.submitSuccess = true;
    this.submitted.emit(responseData);

  } catch (e: any) {
    this.submitError = e?.message || 'Erreur inconnue lors de la soumission.';
    console.error('[QuizFileViewer] Submit error:', e);
  }

  this.loading = false;
}
}
