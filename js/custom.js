/* Site-wide behaviour: the sidebar (slide-in menu on small screens) and, on pages
 * that have them, Bootstrap tooltips and the expandable reference list
 * of the GML Navigator. Needs only jQuery; the optional plugins
 * (Bootstrap's tooltip, MixItUp) are used only when a page loads them.
 **************************************************/
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
