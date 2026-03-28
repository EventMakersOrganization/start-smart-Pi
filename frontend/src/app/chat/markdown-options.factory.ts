import { MarkedOptions, MarkedRenderer } from 'ngx-markdown';
import hljs from 'highlight.js/lib/common';

/** Marked options with highlight.js for fenced code blocks (ngx-markdown). */
export function chatMarkdownOptionsFactory(): MarkedOptions {
  const renderer = new MarkedRenderer();
  renderer.code = (code: string, infostring: string | undefined, _escaped: boolean) => {
    const lang = (infostring || '').match(/\S*/)?.[0] || '';
    let highlighted: string;
    try {
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(code, { language: lang }).value;
      } else {
        highlighted = hljs.highlightAuto(code).value;
      }
    } catch {
      highlighted = hljs.highlightAuto(code).value;
    }
    const cls = lang ? `hljs language-${lang}` : 'hljs';
    return `<pre><code class="${cls}">${highlighted}</code></pre>\n`;
  };
  return {
    gfm: true,
    breaks: true,
    renderer,
  };
}
