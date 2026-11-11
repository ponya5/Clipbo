import { el } from './dom.js';

/** Keyboard-navigable list with a highlighted selection. */
export class ListController {
  constructor(listElement, buildRow, onActivate) {
    this.listElement = listElement;
    this.buildRow = buildRow;
    this.onActivate = onActivate;
    this.items = [];
    this.selectedIndex = 0;
    this.emptyMessage = 'Nothing here yet';
  }

  get selectedItem() {
    return this.items[this.selectedIndex];
  }

  setItems(items, emptyMessage) {
    this.items = items;
    this.emptyMessage = emptyMessage;
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, items.length - 1));
    this.render();
  }

  resetSelection() {
    this.selectedIndex = 0;
  }

  move(delta) {
    if (!this.items.length) return;
    this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
    this.updateSelection();
  }

  itemAt(index) {
    return this.items[index];
  }

  render() {
    this.listElement.replaceChildren();
    if (!this.items.length) {
      this.listElement.append(el('li', { className: 'empty', text: this.emptyMessage }));
      return;
    }
    this.items.forEach((item, index) => {
      const row = this.buildRow(item, index);
      row.addEventListener('click', () => this.onActivate(item));
      row.addEventListener('mousemove', () => this.selectIndexFromMouse(index));
      this.listElement.append(row);
    });
    this.updateSelection();
  }

  selectIndexFromMouse(index) {
    if (index === this.selectedIndex) return;
    this.selectedIndex = index;
    this.updateSelection(false);
  }

  updateSelection(shouldScroll = true) {
    [...this.listElement.children].forEach((row, index) => {
      row.classList.toggle('selected', index === this.selectedIndex);
      if (shouldScroll && index === this.selectedIndex) row.scrollIntoView({ block: 'nearest' });
    });
  }
}
