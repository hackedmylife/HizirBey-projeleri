import test from 'node:test';
import assert from 'node:assert/strict';
await import('../extension/dock.js');
const {geometry, findSearch, Dock} = globalThis.HizirDock;
const box = (left, top, width, height) => ({left, top, width, height, right: left + width, bottom: top + height});
const searchBox = box(750, 6, 468, 40), feedBox = box(521, 115, 925, 425);
function node(label, bounds, attributes = {}) {
  return {textContent: label, style: {}, parentElement: null, getAttribute: key => attributes[key] || '', getClientRects: () => bounds ? [bounds] : [], getBoundingClientRect: () => bounds, closest: () => null};
}
test('search dock keeps the native search accessible and panel above the editor', () => {
  const g = geometry({width: 1914, height: 747, search: searchBox, feed: feedBox, blockers: [searchBox, box(1720, 0, 194, 52)]});
  assert.ok(g.toolbarLeft >= searchBox.right + 8);
  assert.ok(g.toolbarTop >= 0 && g.toolbarTop + 36 <= 52);
  assert.ok(g.panelLeft >= feedBox.left && g.panelLeft + g.panelWidth <= feedBox.right);
  assert.ok(g.panelTop + g.panelHeight < 543);
});
test('crowded headers fall below search and narrow windows keep controls in the viewport', () => {
  const s = box(320, 6, 360, 40);
  const g = geometry({width: 1000, height: 700, search: s, feed: box(250, 115, 500, 400), blockers: [box(0, 0, 320, 52), s, box(680, 0, 320, 52)]});
  assert.ok(g.toolbarTop > s.bottom);
  assert.ok(g.panelTop > g.toolbarTop + 36);
  assert.ok(g.panelTop + g.panelHeight < 515);
  const small = geometry({width: 320, height: 600, search: null});
  assert.ok(small.toolbarLeft >= 0 && small.toolbarLeft + 264 <= 320);
  assert.ok(small.panelLeft >= 0 && small.panelLeft + small.panelWidth <= 320);
});
test('only the top search is detected, including an unlabeled clickable div', () => {
  const native = node('Search Ctrl K', searchBox);
  const label = node('Search', box(800, 20, 50, 20)); label.parentElement = native;
  native.parentElement = node('Search Ctrl K Help', box(0, 0, 1914, 52));
  const chatSearch = node('Search', box(60, 130, 350, 40));
  const root = {querySelectorAll: selector => selector === 'span, p' ? [label] : [chatSearch]};
  assert.equal(findSearch(root, 1914), native);
});
test('docking and SPA replacement change only extension-owned positions', () => {
  const native = node('Search Ctrl K', searchBox), feed = node('Messages', feedBox), editor = node('Unsent member response', box(540, 543, 891, 129));
  const original = JSON.stringify([native, feed, editor]);
  let currentSearch = native;
  const root = {body: {}, querySelectorAll: selector => selector === 'span, p' ? [] : selector === '[data-testid="chat-feed"]' ? [feed] : [currentSearch]};
  globalThis.MutationObserver = class {observe() {}};
  globalThis.ResizeObserver = class {observe() {} disconnect() {}};
  const toolbar = {style: {}, dataset: {}}, panel = {style: {}};
  const viewport = {innerWidth: 1914, innerHeight: 747, addEventListener() {}, setTimeout() {}};
  const dock = new Dock({toolbar, panel, root, viewport});
  assert.equal(toolbar.dataset.anchor, 'search');
  assert.equal(JSON.stringify([native, feed, editor]), original);
  const before = panel.style.left;
  currentSearch = node('Search Ctrl K', box(800, 6, 468, 40));
  dock.update(); assert.notEqual(panel.style.left, before);
  assert.equal(JSON.stringify([native, feed, editor]), original);
});
