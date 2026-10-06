/* Typography helper for all pages: no single words on the last line (widows/orphans).
 *
 * 1. Joins the last two words of every paragraph, list item, heading and
 *    publication field with a no-break space, so a short final word never
 *    ends up alone on a line (CSS text-wrap: pretty does the rest where supported).
 * 2. On Polish-language content, keeps one-letter words (a, i, o, u, w, z)
 *    together with the following word, as Polish typography requires.
 *
 * Runs once on load and again for content added later (e.g. the GML Navigator list).
 * Text containing TeX ($…$, \(…\)) and MathJax output is left untouched.
 */
(function () {
	'use strict';

	var SELECTOR = [
		'#main p', '#main li', '#main dd', '#main figcaption', '#main address',
		'#main h1', '#main h2', '#main h3', '#main h4', '#main h5',
		'.pl-title', '.pl-authors', '.pl-venue', '.pl-note',
		'.pubtitle', '.pubauthor', '.pubcite', '.am-prize', '.nv-name', '.content'
	].join(',');
	var BLOCKS = 'p,li,ul,ol,div,h1,h2,h3,h4,h5,h6,table,section,article,aside,figure,address';
	var MAX_TAIL = 24;          // only glue when the final word is short enough
	var NBSP = '\u00A0';
	var WJ = '\u2060';          // word joiner: no line break after a hyphen in the final words
	var TEX = /\$|\\\(|\\\[/;

	function skippable(node) {
		var el = node.parentNode;
		return !el || el.closest('script,style,code,pre,mjx-container,.MathJax,textarea') || TEX.test(node.nodeValue);
	}

	function textNodes(el) {
		var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
		while ((n = w.nextNode())) { if (n.nodeValue.length) out.push(n); }
		return out;
	}

	function polish(nodes) {
		nodes.forEach(function (t) {
			if (skippable(t)) return;
			var v = t.nodeValue.replace(/(^|[\s(„"«])([aiouwzAIOUWZ]) (?=\S)/g, '$1$2' + NBSP);
			if (v !== t.nodeValue) t.nodeValue = v;
		});
	}

	function noHyphenBreak(s) { return s.replace(/-(?!\u2060)/g, '-' + WJ); }

	function glueLast(nodes) {
		var tail = 0, sawText = false;
		for (var i = nodes.length - 1; i >= 0; i--) {
			var t = nodes[i], v = t.nodeValue;
			if (skippable(t)) return;
			var end = sawText ? v.length : v.replace(/\s+$/, '').length;
			if (end === 0) continue;
			sawText = true;
			var k = v.lastIndexOf(' ', end - 1);
			if (k === -1) { tail += end; if (tail > MAX_TAIL) return; continue; }
			tail += end - k - 1;
			if (tail === 0 || tail > MAX_TAIL) return;
			// glue the last two words and keep hyphenated final words in one piece
			var prev = v.lastIndexOf(' ', k - 1);
			t.nodeValue = v.slice(0, prev + 1) + noHyphenBreak(v.slice(prev + 1, k)) + NBSP + noHyphenBreak(v.slice(k + 1));
			for (var j = i + 1; j < nodes.length; j++) {
				if (!skippable(nodes[j])) nodes[j].nodeValue = noHyphenBreak(nodes[j].nodeValue);
			}
			return;
		}
	}

	function fix(el) {
		if (el.hasAttribute('data-nw')) return;
		if (el.closest('.am-journey')) return;   // narrow timeline columns: let the browser wrap freely
		if (el.querySelector(BLOCKS) && !el.matches('.pl-title,.pubtitle,.pl-authors,.pubauthor')) return;
		var nodes = textNodes(el);
		if (!nodes.length) return;
		var lang = (el.closest('[lang]') || document.documentElement).getAttribute('lang');
		if (lang && lang.indexOf('pl') === 0) polish(nodes);
		if (el.textContent.trim().split(/\s+/).length >= 3) glueLast(nodes);
		el.setAttribute('data-nw', '');
	}

	function run(root) {
		if (!root || !root.querySelectorAll) return;
		if (root.matches && root.matches(SELECTOR)) fix(root);
		Array.prototype.forEach.call(root.querySelectorAll(SELECTOR), fix);
	}

	function start() {
		run(document.body);
		if ('MutationObserver' in window) {
			var pending = null;
			new MutationObserver(function (muts) {
				muts.forEach(function (m) {
					Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) (pending = pending || []).push(n); });
				});
				if (pending) {
					var batch = pending; pending = null;
					requestAnimationFrame(function () { batch.forEach(run); });
				}
			}).observe(document.body, { childList: true, subtree: true });
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
})();
