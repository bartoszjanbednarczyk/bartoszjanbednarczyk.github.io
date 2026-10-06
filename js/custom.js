/* Site-wide behaviour: the sidebar (slide-in menu on small screens) and, on pages
 * that have them, Bootstrap tooltips and the expandable reference list
 * of the GML Navigator. Needs only jQuery; the optional plugins
 * (Bootstrap's tooltip, MixItUp) are used only when a page loads them.
 **************************************************/
/* Foldable sidebar: restore the saved state before the first paint (no flash). */
(function () {
	try {
		var v = localStorage.getItem('sidebar-folded');
		if (v === null) v = localStorage.getItem('nd-sidebar-folded');
		if (v === '1') document.documentElement.className += ' sb-folded sb-noanim';
	} catch (e) {}
})();

(function ($) {
	'use strict';

	// fire a debounced 'resized' event on window
	var resizeTimer;
	$(window).on('resize', function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(function () { $(window).trigger('resized'); }, 200);
	});

	$(function () {
		var $side = $('#sidebar'), $main = $('#main'), $trigger = $('a.mobilemenu'),
			$footer = $('#sidebar-footer'), $nav = $('#main-nav');
		var navPadding = parseInt($nav.css('padding-bottom'), 10) || 0;
		var DURATION = 400;

		function isIn() { return $main.hasClass('sideIn'); }

		function sideIn() {
			var w = $side.width();
			$main.stop(true).animate({ left: w, right: -w }, DURATION, function () {
				if ($(window).width() <= 600) $main.css('display', 'none'); // sidebar covers the whole screen
			});
			$main.addClass('sideIn');
		}

		function sideOut() {
			if ($(window).width() <= 600) $main.css('display', 'block');
			$main.stop(true).animate({ left: 0, right: 0 }, DURATION);
			$main.removeClass('sideIn');
		}

		function setContentPadding() {
			$nav.css({ paddingBottom: navPadding + $footer.outerHeight() });
		}

		function setMobileSide() {
			var w = $(window).width();
			if (w < 600) {
				$side.width(w);
			} else {
				$side.width('');
				$main.css('display', 'block');
			}
		}

		$trigger.on('click', function (e) {
			e.preventDefault();
			if (isIn()) sideOut(); else sideIn();
		});

		$('.social-icons, #main-nav, #main').on('click', function () {
			if ($(window).width() < 960 && isIn()) sideOut();
		});

		$(window).on('resized', function () {
			setContentPadding();
			if ($(window).width() > 991) {
				$main.css({ left: 250, right: 0 }).addClass('sideIn');
			} else {
				$main.css({ left: 0, right: 0 }).removeClass('sideIn');
			}
			$side.css({ left: 0 });
			setMobileSide();
		});

		setContentPadding();
		setMobileSide();

		// foldable sidebar (desktop): handle on the sidebar edge; shared state for all pages
		var html = document.documentElement;
		var pl = (html.lang || '').indexOf('pl') === 0;
		var T = pl ? { hide: 'Zwiń panel boczny', show: 'Pokaż panel boczny' } : { hide: 'Hide sidebar', show: 'Show sidebar' };
		var $fold = $('<button type="button" class="sb-fold" id="sb-fold" aria-controls="sidebar">' +
			'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M8 1.5 3.5 6 8 10.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>').insertAfter($side);
		function isFolded() { return (' ' + html.className + ' ').indexOf(' sb-folded ') >= 0; }
		function notifyFrames() { // e.g. the natural-deduction app adjusts its own button
			$('iframe').each(function () { try { var w = this.contentWindow; if (w && w.ndSidebarState) w.ndSidebarState(isFolded()); } catch (e) {} });
		}
		function setFold(f, store) {
			$(html).toggleClass('sb-folded', f);
			$fold.attr({ 'aria-expanded': String(!f), title: f ? T.show : T.hide, 'aria-label': f ? T.show : T.hide });
			if (store) { try { localStorage.setItem('sidebar-folded', f ? '1' : '0'); } catch (e) {} }
			notifyFrames();
		}
		window.ndToggleSidebar = function () { setFold(!isFolded(), true); };
		window.ndSidebarFolded = isFolded;
		$fold.on('click', window.ndToggleSidebar);
		setFold(isFolded(), false);
		setTimeout(function () { $(html).removeClass('sb-noanim'); }, 60);
		$('iframe').on('load', notifyFrames);
		$(window).on('resized', notifyFrames);

		// tooltips (only where Bootstrap's JavaScript is loaded)
		if ($.fn.tooltip) $('.tooltips').tooltip();

		// expandable reference list (GML Navigator)
		var $grid = $('div#pub-grid');
		if ($grid.length) {
			if ($.fn.mixitup) {
				$grid.mixitup({
					layoutMode: 'list',
					easing: 'snap',
					transitionSpeed: 600,
					onMixEnd: function () { if ($.fn.tooltip) $('.tooltips').tooltip(); }
				});
			}
			$grid.on('click', 'div.pubmain', function () {
				var $this = $(this);
				$this.closest('.item').find('div.pubdetails').slideToggle(function () {
					$this.children('i').toggleClass('icon-collapse-alt icon-expand-alt');
				});
			});
		}
	});
})(jQuery);
