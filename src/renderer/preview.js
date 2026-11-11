import { el } from './dom.js';

/** Quick Look-style overlay for images and videos. */
export class Preview {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.containerElement.addEventListener('click', () => this.close());
  }

  isOpen() {
    return !this.containerElement.hidden;
  }

  show(preview) {
    this.containerElement.replaceChildren(this.buildContent(preview));
    this.containerElement.hidden = false;
  }

  close() {
    this.containerElement.querySelector('video')?.pause();
    this.containerElement.replaceChildren();
    this.containerElement.hidden = true;
  }

  buildContent(preview) {
    if (preview.kind === 'video') {
      const video = el('video', { attributes: { src: preview.url, controls: '', autoplay: '' } });
      video.addEventListener('click', (event) => event.stopPropagation());
      return video;
    }
    if (preview.kind === 'image') return el('img', { attributes: { src: preview.url, alt: 'Preview' } });
    return el('div', { className: 'preview-missing', text: `Cannot preview "${preview.name}". The file may have been moved or deleted.` });
  }
}
