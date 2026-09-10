/* ==========================================================================
   Design Mindset — Experience v2 controller
   ========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------------
     0. Cursor glow — soft lime-green light that follows the pointer
     ---------------------------------------------------------------------- */
  (function cursorGlow() {
    if (reduce || window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    var x = window.innerWidth / 2, y = window.innerHeight / 2;
    var cx = x, cy = y;
    var active = false;

    document.addEventListener('mousemove', function (e) {
      x = e.clientX; y = e.clientY;
      if (!active) { active = true; glow.classList.add('is-active'); }
    }, { passive: true });
    document.addEventListener('mouseleave', function () { glow.classList.remove('is-active'); });
    document.addEventListener('mousedown', function () { glow.classList.add('is-down'); });
    document.addEventListener('mouseup', function () { glow.classList.remove('is-down'); });

    (function loop() {
      cx += (x - cx) * 0.16;
      cy += (y - cy) * 0.16;
      glow.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
  })();

  var scrollRoot = document.getElementById('experienceRoot');
  var useLocalScroll = false;
  var useVirtualScroll = false;
  var virtualY = 0;
  var drawStoryLine = function () {};

  function getStaticTop(el) {
    var top = 0;
    while (el && el !== scrollRoot && el !== document.body) {
      top += el.offsetTop || 0;
      el = el.offsetParent;
    }
    return top;
  }

  function getStaticLeft(el) {
    var left = 0;
    while (el && el !== scrollRoot && el !== document.body) {
      left += el.offsetLeft || 0;
      el = el.offsetParent;
    }
    return left;
  }

  function getScrollTop() {
    if (useVirtualScroll) return virtualY;
    return useLocalScroll && scrollRoot ? scrollRoot.scrollTop : window.scrollY;
  }

  function getScrollMax() {
    if (useLocalScroll && scrollRoot) return scrollRoot.scrollHeight - scrollRoot.clientHeight;
    var doc = document.documentElement;
    return doc.scrollHeight - doc.clientHeight;
  }

  function getFullHeight() {
    if ((useLocalScroll || useVirtualScroll) && scrollRoot) return scrollRoot.scrollHeight;
    return document.documentElement.scrollHeight;
  }

  function scrollToY(top) {
    if (useVirtualScroll) {
      animateVirtualTo(top);
      return;
    }
    if (useLocalScroll && scrollRoot) {
      scrollRoot.scrollTo({ top: top, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }

  function calibrateScrollRoot() {
    window.scrollTo(0, 2);
    var doc = document.documentElement;
    useLocalScroll = window.scrollY === 0 && scrollRoot && doc.scrollHeight > doc.clientHeight;
    if (useLocalScroll) {
      document.body.classList.add('use-local-scroll');
      scrollRoot.scrollTop = 0;
      scrollRoot.scrollTop = 2;
      useVirtualScroll = scrollRoot.scrollTop === 0 && scrollRoot.scrollHeight > scrollRoot.clientHeight;
      scrollRoot.scrollTop = 0;
      if (useVirtualScroll) {
        document.body.classList.add('use-virtual-scroll');
        document.body.classList.remove('use-local-scroll');
        setVirtualScroll(0);
      }
    } else {
      document.body.classList.remove('use-local-scroll');
      window.scrollTo(0, 0);
    }
  }
  calibrateScrollRoot();

  // In virtual-scroll mode the root must never scroll natively — all motion is
  // driven by the CSS transform. Focus() / scrollIntoView on descendants (e.g.
  // restoring focus after the case-study lightbox closes) can still set
  // scrollTop on the overflow:hidden root, which stacks on top of the transform
  // and leaves a blank gap under the footer while throwing off the nav math.
  // Snap it back to 0 whenever that happens.
  if (scrollRoot) {
    scrollRoot.addEventListener('scroll', function () {
      if (useVirtualScroll && scrollRoot.scrollTop !== 0) scrollRoot.scrollTop = 0;
    }, { passive: true });
  }

  // Smoothed virtual scroll: wheel/keys nudge a *target* position and a RAF
  // loop eases the rendered position toward it, so big batched wheel/trackpad
  // deltas glide instead of snapping. Touch follows the finger 1:1 and then
  // keeps gliding (momentum) after release.
  var virtualTargetY = 0;
  var virtualRAF = null;

  function clampVirtual(y) {
    return Math.max(0, Math.min(y, getScrollMax()));
  }

  function renderVirtual(y) {
    if (!scrollRoot) return;
    virtualY = clampVirtual(y);
    scrollRoot.style.setProperty('--virtual-y', (-virtualY) + 'px');
    updateHeaderSolid();
    drawStoryLine();
    updateVirtualGuide();
    updateVirtualReveals();
    updatePromoScale();
  }

  function stopVirtualAnim() {
    if (virtualRAF) { cancelAnimationFrame(virtualRAF); virtualRAF = null; }
  }

  function stepVirtual() {
    var diff = virtualTargetY - virtualY;
    if (Math.abs(diff) < 0.4) {
      virtualRAF = null;
      renderVirtual(virtualTargetY);
      return;
    }
    renderVirtual(virtualY + diff * 0.18);
    virtualRAF = requestAnimationFrame(stepVirtual);
  }

  // Immediate jump (used for init and programmatic resets).
  function setVirtualScroll(nextY) {
    if (!scrollRoot) return;
    stopVirtualAnim();
    virtualTargetY = clampVirtual(nextY);
    renderVirtual(virtualTargetY);
  }

  // Eased move toward a target position.
  function animateVirtualTo(nextY) {
    if (!scrollRoot) return;
    virtualTargetY = clampVirtual(nextY);
    if (reduce) { stopVirtualAnim(); renderVirtual(virtualTargetY); return; }
    if (!virtualRAF) virtualRAF = requestAnimationFrame(stepVirtual);
  }

  function onVirtualWheel(e) {
    if (!useVirtualScroll) return;
    e.preventDefault();
    animateVirtualTo(virtualTargetY + e.deltaY);
  }

  var touchLastY = 0, touchLastT = 0, touchVel = 0;
  function onVirtualTouchStart(e) {
    if (!useVirtualScroll || !e.touches.length) return;
    stopVirtualAnim();
    touchLastY = e.touches[0].clientY;
    touchLastT = e.timeStamp || Date.now();
    touchVel = 0;
    virtualTargetY = virtualY;
  }

  function onVirtualTouchMove(e) {
    if (!useVirtualScroll || !e.touches.length) return;
    e.preventDefault();
    var currentY = e.touches[0].clientY;
    var now = e.timeStamp || Date.now();
    var dy = touchLastY - currentY;
    var dt = now - touchLastT;
    if (dt > 0) touchVel = touchVel * 0.7 + (dy / dt) * 0.3; // px/ms, smoothed
    virtualTargetY = clampVirtual(virtualTargetY + dy);
    renderVirtual(virtualTargetY); // follow the finger with no lag
    touchLastY = currentY;
    touchLastT = now;
  }

  function onVirtualTouchEnd() {
    if (!useVirtualScroll || reduce) return;
    // Fling: project the release velocity into a glide the easing loop settles.
    if (Math.abs(touchVel) > 0.02) animateVirtualTo(virtualTargetY + touchVel * 240);
  }

  function onVirtualKey(e) {
    if (!useVirtualScroll) return;
    var step = window.innerHeight * 0.85;
    if (e.key === 'ArrowDown') { e.preventDefault(); animateVirtualTo(virtualTargetY + 80); }
    if (e.key === 'ArrowUp') { e.preventDefault(); animateVirtualTo(virtualTargetY - 80); }
    if (e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); animateVirtualTo(virtualTargetY + step); }
    if (e.key === 'PageUp') { e.preventDefault(); animateVirtualTo(virtualTargetY - step); }
    if (e.key === 'Home') { e.preventDefault(); animateVirtualTo(0); }
    if (e.key === 'End') { e.preventDefault(); animateVirtualTo(getScrollMax()); }
  }

  window.addEventListener('wheel', onVirtualWheel, { passive: false });
  window.addEventListener('touchstart', onVirtualTouchStart, { passive: true });
  window.addEventListener('touchmove', onVirtualTouchMove, { passive: false });
  window.addEventListener('touchend', onVirtualTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onVirtualTouchEnd, { passive: true });
  window.addEventListener('keydown', onVirtualKey);

  /* ----------------------------------------------------------------------
     1. Floating guide — updates per chapter via IntersectionObserver
     ---------------------------------------------------------------------- */
  var guide       = document.getElementById('guide');
  var guidePortrait = document.getElementById('guidePortrait');
  var guidePhoto  = document.getElementById('guidePhoto');
  var guideBubble = guide ? guide.querySelector('.guide__bubble') : null;
  var PORTRAIT_PLACEHOLDER = 'assets/portrait-placeholder.png';
  // Real portraits per speaker; falls back to the silhouette placeholder.
  var GUIDE_PORTRAITS = { 'Georgiana': 'assets/georgiana.png' };
  var guideName   = document.getElementById('guideName');
  var guideRole   = document.getElementById('guideRole');
  var guideQuote  = document.getElementById('guideQuote');
  var guideInitials = document.getElementById('guideInitials');
  var chapters    = Array.prototype.slice.call(document.querySelectorAll('[data-guide-name]'));
  var finalSection = document.querySelector('.final');
  var currentKey  = '';
  var currentName = '';
  var guideSwapTimer = null;

  // The guide belongs to the cinematic chapters only. It appears after the hero
  // and steps aside once the closing "traditional layout" (portfolio/contact) begins.
  function guideAllowedAt(scrollTop) {
    if (scrollTop <= window.innerHeight * 0.3) return false;
    if (finalSection && getStaticTop(finalSection) <= scrollTop + window.innerHeight * 0.55) return false;
    return true;
  }
  function syncGuideVisibility() {
    if (guide) guide.classList.toggle('is-visible', guideAllowedAt(getScrollTop()));
  }

  function setGuide(el) {
    var name = el.getAttribute('data-guide-name');
    var role = el.getAttribute('data-guide-role') || '';
    var quote = el.getAttribute('data-guide-quote') || '';
    var portrait = el.getAttribute('data-guide-portrait') || '';
    var initials = el.getAttribute('data-guide-initials') || name.charAt(0);
    var key = name + quote;
    if (key === currentKey) return;
    currentKey = key;
    var speakerChanged = name !== currentName;
    currentName = name;

    // Cancel any swap still mid-flight so rapid scrolling can't stack multiple
    // fade-out/fade-in passes on top of each other (the cause of the flicker).
    if (guideSwapTimer) { clearTimeout(guideSwapTimer); guideSwapTimer = null; }

    guideQuote.classList.add('is-swapping');
    guideSwapTimer = window.setTimeout(function () {
      guideSwapTimer = null;
      guideName.textContent = name;
      guideRole.textContent = role;
      guideQuote.innerHTML = quote;
      if (guideInitials) guideInitials.textContent = initials;
      // Show the real portrait when a chapter provides one, otherwise fall back
      // to the transparent silhouette placeholder (never the bare initials).
      var src = portrait || GUIDE_PORTRAITS[name] || PORTRAIT_PLACEHOLDER;
      if (guide) guide.classList.remove('is-abstract');
      if (guidePhoto && guidePhoto.getAttribute('src') !== src) {
        guidePhoto.setAttribute('src', src);
        guidePhoto.setAttribute('alt', portrait ? name : '');
      }
      // Re-trigger the bubble pop only when the speaker actually changes; for a
      // same-speaker quote change we just cross-fade the quote so it stays calm.
      if (guideBubble && speakerChanged) {
        guideBubble.style.animation = 'none';
        void guideBubble.offsetWidth;
        guideBubble.style.animation = '';
      }
      guideQuote.classList.remove('is-swapping');
    }, reduce ? 0 : 300);
  }

  if (guide && chapters.length && 'IntersectionObserver' in window) {
    var guideObs = new IntersectionObserver(function (entries) {
      // In virtual/local scroll modes the deterministic updateVirtualGuide()
      // already drives the guide on every tick; letting the observer also fire
      // makes the two disagree at chapter boundaries and flip the guide back
      // and forth. Defer entirely to the scroll driver in those modes.
      if (useVirtualScroll || useLocalScroll) return;
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio > 0.4) setGuide(e.target);
      });
    }, { threshold: [0.4, 0.6] });
    chapters.forEach(function (c) { guideObs.observe(c); });
  }

  function updateVirtualGuide() {
    if (!useVirtualScroll || !chapters || !chapters.length) return;
    var midpoint = virtualY + window.innerHeight * 0.24;
    var active = chapters[0];
    chapters.forEach(function (chapter) {
      if (getStaticTop(chapter) <= midpoint) active = chapter;
    });
    if (guide) guide.classList.toggle('is-visible', guideAllowedAt(virtualY));
    if (header) header.classList.toggle('is-visible', virtualY > window.innerHeight * 0.3);
    if (chapterNav) chapterNav.classList.toggle('is-visible', virtualY > window.innerHeight * 0.3);
    setGuide(active);
  }

  function updateVirtualReveals() {
    if (!useVirtualScroll) return;
    document.querySelectorAll('.reveal').forEach(function (item) {
      if (getStaticTop(item) < virtualY + window.innerHeight * 0.88) item.classList.add('is-in');
    });
    document.querySelectorAll('[data-animate-in]').forEach(function (section) {
      if (getStaticTop(section) < virtualY + window.innerHeight * 0.72) section.classList.add('is-in');
    });
  }

  /* ----------------------------------------------------------------------
     2. Show guide + header once the visitor leaves the hero
     ---------------------------------------------------------------------- */
  var header = document.getElementById('expHeader');
  var hero   = document.getElementById('hero');
  if (hero && 'IntersectionObserver' in window) {
    var heroObs = new IntersectionObserver(function (entries) {
      var past = !entries[0].isIntersecting;
      if (guide)  guide.classList.toggle('is-visible', past && guideAllowedAt(getScrollTop()));
      if (header) header.classList.toggle('is-visible', past);
      if (chapterNav) chapterNav.classList.toggle('is-visible', past);
    }, { threshold: 0.35 });
    heroObs.observe(hero);
  }
  function updateHeaderSolid() {
    if (header) header.classList.toggle('is-solid', getScrollTop() > window.innerHeight * 0.9);
  }
  window.addEventListener('scroll', updateHeaderSolid, { passive: true });
  if (scrollRoot) scrollRoot.addEventListener('scroll', updateHeaderSolid, { passive: true });

  /* ----------------------------------------------------------------------
     2b. Chapter navigation rail + active-section tracking
     ---------------------------------------------------------------------- */
  var chapterNav = document.getElementById('chapterNav');
  var navDots = [];
  if (chapterNav) {
    Array.prototype.slice.call(document.querySelectorAll('[data-nav]')).forEach(function (sec) {
      if (!sec.id) return;
      var dot = document.createElement('a');
      dot.className = 'chapter-nav__dot';
      dot.href = '#' + sec.id;
      dot.setAttribute('data-label', sec.getAttribute('data-nav'));
      dot.setAttribute('aria-label', 'Go to ' + sec.getAttribute('data-nav'));
      chapterNav.appendChild(dot);
      navDots.push({ el: dot, target: sec });
    });
  }
  function updateActiveChapter() {
    if (!navDots.length) return;
    var probe = getScrollTop() + window.innerHeight * 0.42;
    var activeIdx = 0;
    navDots.forEach(function (d, i) { if (getStaticTop(d.target) <= probe) activeIdx = i; });
    navDots.forEach(function (d, i) { d.el.classList.toggle('is-active', i === activeIdx); });
  }

  /* ----------------------------------------------------------------------
     2c. Staggered grid reveals
     ---------------------------------------------------------------------- */
  ['.team__grid', '.portfolio__track'].forEach(function (sel) {
    var grid = document.querySelector(sel);
    if (!grid) return;
    Array.prototype.slice.call(grid.children).forEach(function (child, i) {
      child.style.setProperty('--i', i);
    });
  });

  /* ----------------------------------------------------------------------
     2d. Magnetic buttons
     ---------------------------------------------------------------------- */
  if (!reduce) {
    document.querySelectorAll('.contact__cta, .exp-header__cta').forEach(function (m) {
      m.addEventListener('mousemove', function (e) {
        var r = m.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width / 2);
        var my = e.clientY - (r.top + r.height / 2);
        m.style.transform = 'translate(' + (mx * 0.28) + 'px,' + (my * 0.28) + 'px)';
      });
      m.addEventListener('mouseleave', function () { m.style.transform = ''; });
    });
  }

  /* ----------------------------------------------------------------------
     2e. Promo video — docks into its grid slot, grows toward near-fullscreen
         as it approaches the viewport centre, then LOCKS at that size (it
         does not shrink back). Once locked, further scrolling slides it
         away like normal content, revealing the next section beneath it.
         The visible video is a position:fixed overlay (outside the
         virtual-scroll transform); an invisible spacer reserves its slot.
     ---------------------------------------------------------------------- */
  var promoSpacer = document.getElementById('promoSpacer');
  var promoOverlay = document.getElementById('promoOverlay');
  var promoSection = document.getElementById('chapter-1');
  var chapter1Text = document.getElementById('chapter1Text');

  // Fully-grown box: TOP is pinned near the top of the viewport and the video
  // only grows DOWNWARD (width grows too, horizontally centred). It never
  // expands upward past this anchor.
  function fullscreenPromoRect() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var topAnchor = vh * 0.09;
    var maxW = vw * 0.94, maxH = vh * 0.84;
    var w = maxW, h = w * 9 / 16;
    if (h > maxH) { h = maxH; w = h * 16 / 9; }
    return { width: w, height: h, left: (vw - w) / 2, top: topAnchor };
  }

  function setPromoBox(left, top, w, h, radius) {
    promoOverlay.style.left = left.toFixed(1) + 'px';
    promoOverlay.style.top = top.toFixed(1) + 'px';
    promoOverlay.style.width = w.toFixed(1) + 'px';
    promoOverlay.style.height = h.toFixed(1) + 'px';
    promoOverlay.style.borderRadius = radius.toFixed(1) + 'px';
  }

  // Stateless, fully scroll-linked (no speed multipliers): the video behaves
  // like a `position: sticky` element bounded by its Chapter-1 section, so it
  // stays locked to the page and can never overlap Chapter 2.
  function updatePromoScale() {
    if (!promoSpacer || !promoOverlay || !promoSection) return;
    var vh = window.innerHeight;
    var r = promoSpacer.getBoundingClientRect();     // docked grid slot
    var sec = promoSection.getBoundingClientRect();  // section (incl. release buffer)
    var full = fullscreenPromoRect();

    if (reduce) {
      chapter1Text && (chapter1Text.style.opacity = '');
      return;
    }

    if (r.top > full.top) {
      // Not pinned yet — docked in the grid slot, tracking it exactly (small).
      setPromoBox(r.left, r.top, r.width, r.height, 18);
      promoOverlay.style.opacity = '1';
      if (chapter1Text) chapter1Text.style.opacity = '1';
      return;
    }

    // Pinned: grow downward from the fixed top anchor as we scroll past the pin.
    var growD = vh * 0.36;
    var p = Math.min(1, Math.max(0, (full.top - r.top) / growD)); // 0 → 1 while scrolling past the pin
    var w = r.width + (full.width - r.width) * p;
    var h = r.height + (full.height - r.height) * p;
    var left = r.left + (full.left - r.left) * p;
    // Sticky top: stays at the anchor, then rides the section bottom up 1:1
    // with the page once the section (buffer) runs out — same speed as content.
    var top = Math.min(full.top, sec.bottom - full.height);
    setPromoBox(left, top, w, h, 18 - 10 * p);
    promoOverlay.style.opacity = (top + h < 0) ? '0' : '1';
    if (chapter1Text) chapter1Text.style.opacity = (1 - p).toFixed(3);
  }
  if (promoSpacer && promoOverlay) {
    var promoTicking = false;
    var onPromoScroll = function () {
      if (promoTicking) return;
      promoTicking = true;
      requestAnimationFrame(function () { promoTicking = false; updatePromoScale(); });
    };
    window.addEventListener('scroll', onPromoScroll, { passive: true });
    if (scrollRoot) scrollRoot.addEventListener('scroll', onPromoScroll, { passive: true });
    window.addEventListener('resize', onPromoScroll, { passive: true });
    updatePromoScale();
  }

  /* ----------------------------------------------------------------------
     3. Neon storyline — a single line that weaves through every section
        title, lighting up each node (and its title) as you reach it.
     ---------------------------------------------------------------------- */
  var storylineEl = document.getElementById('storyline');
  var storySvg    = document.getElementById('storySvg');
  var storyTrack  = document.getElementById('storyTrack');
  var storyPath   = document.getElementById('storyPath');
  var storyComet  = document.getElementById('storyComet');
  var storyNodesG = document.getElementById('storyNodes');
  var storyLen = 0, cometLen = 0, yTable = [], nodeMarkers = [];
  var storyDrawn = 0, storyTarget = 0, storyRAF = null;

  function renderStoryLine(drawn) {
    if (!storyLen) return;
    storyPath.style.strokeDashoffset = storyLen - drawn;
    if (storyComet) storyComet.style.strokeDashoffset = cometLen - drawn;
    if (storylineEl) storylineEl.classList.toggle('is-live', drawn > cometLen && drawn < storyLen - 2);
    nodeMarkers.forEach(function (m) {
      var on = drawn >= m.l - 1;
      m.circle.classList.toggle('is-on', on);
      if (m.el) m.el.classList.toggle('is-linked', on);
    });
  }

  function stepStoryLine() {
    var diff = storyTarget - storyDrawn;
    if (Math.abs(diff) < 0.5) {
      storyDrawn = storyTarget;
      renderStoryLine(storyDrawn);
      storyRAF = null;
      return;
    }
    storyDrawn += diff * 0.16;
    renderStoryLine(storyDrawn);
    storyRAF = requestAnimationFrame(stepStoryLine);
  }

  function lengthAtY(targetY) {
    if (!yTable.length) return 0;
    if (targetY <= yTable[0].y) return 0;
    var last = yTable[yTable.length - 1];
    if (targetY >= last.y) return last.l;
    var lo = 0, hi = yTable.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (yTable[mid].y < targetY) lo = mid + 1; else hi = mid; }
    var b = yTable[lo], a = yTable[lo - 1] || yTable[0];
    var t = (b.y - a.y) ? (targetY - a.y) / (b.y - a.y) : 0;
    return a.l + (b.l - a.l) * t;
  }

  function buildStoryline() {
    if (!storySvg || !storyPath) return;
    var heads = Array.prototype.slice.call(document.querySelectorAll('[data-story-node]'));
    if (!heads.length) return;
    var vw = (useLocalScroll && scrollRoot ? scrollRoot.clientWidth : document.documentElement.clientWidth) || window.innerWidth;
    var contentH = getFullHeight();
    // Each title becomes a point the line threads through vertically:
    // it enters at the title's top and exits at the bottom, weaving
    // left/right to line up with where each title actually sits.
    var pts = heads.map(function (h) {
      var rawTop = getStaticTop(h);
      var left = getStaticLeft(h);
      var w = h.offsetWidth;
      var centered = getComputedStyle(h).textAlign === 'center';
      var cx = centered ? left + w / 2 : left + Math.min(w * 0.5, 54);
      cx = Math.max(22, Math.min(cx, vw - 22));
      return { el: h, x: cx, topY: rawTop - 4, midY: rawTop + h.offsetHeight / 2, botY: rawTop + h.offsetHeight + 4 };
    }).sort(function (a, b) { return a.topY - b.topY; });

    // Weave to each title's top, run straight down through it, then
    // continue from the bottom toward the next title. The final title
    // is where the whole line culminates — it ends inside it.
    // The line is born at the hero's play button and flows down into the story.
    var heroSec = document.getElementById('hero');
    var startX = vw / 2;
    // Begin exactly at the hero's bottom edge so the line emerges right where
    // the hero thread ends — no gap, no occluded segment behind the hero.
    var startY = heroSec ? Math.max(0, getStaticTop(heroSec) + heroSec.offsetHeight) : 0;
    var d = 'M ' + startX + ' ' + startY;
    var px = startX, py = startY;
    pts.forEach(function (n, idx) {
      var isLast = idx === pts.length - 1;
      var dy = n.topY - py;
      d += ' C ' + px + ' ' + (py + dy * 0.45) +
           ', ' + n.x + ' ' + (n.topY - dy * 0.35) +
           ', ' + n.x + ' ' + n.topY;
      if (isLast) {
        d += ' L ' + n.x + ' ' + n.midY;
        px = n.x; py = n.midY;
      } else {
        d += ' L ' + n.x + ' ' + n.botY;
        px = n.x; py = n.botY;
      }
    });

    storySvg.setAttribute('viewBox', '0 0 ' + vw + ' ' + contentH);
    storySvg.style.height = contentH + 'px';
    if (storyTrack) storyTrack.setAttribute('d', d);
    storyPath.setAttribute('d', d);
    if (storyComet) storyComet.setAttribute('d', d);

    storyLen = storyPath.getTotalLength();
    cometLen = Math.max(6, storyLen * 0.014);
    storyPath.style.strokeDasharray = storyLen;
    storyPath.style.strokeDashoffset = storyLen;
    if (storyComet) storyComet.style.strokeDasharray = cometLen + ' ' + (storyLen + cometLen);

    // Sample the path so we can map a scroll Y → drawn length precisely.
    yTable = [];
    var samples = 260;
    for (var i = 0; i <= samples; i++) {
      var l = storyLen * i / samples;
      var pt = storyPath.getPointAtLength(l);
      yTable.push({ y: pt.y, l: l });
    }

    // Draw the node dots on the line.
    // A glowing dot marks where the line enters each title; the last is a finale.
    heads.forEach(function (h) { h.classList.remove('is-finale'); });
    if (storyNodesG) storyNodesG.innerHTML = '';
    nodeMarkers = pts.map(function (n, idx) {
      var isLast = idx === pts.length - 1;
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', n.x);
      c.setAttribute('cy', n.topY);
      c.setAttribute('r', isLast ? '6.5' : '4.5');
      c.setAttribute('class', isLast ? 'storyline__node storyline__node--finale' : 'storyline__node');
      if (storyNodesG) storyNodesG.appendChild(c);
      if (isLast && n.el) n.el.classList.add('is-finale');
      return { circle: c, el: n.el, l: lengthAtY(isLast ? n.midY : n.topY) };
    });
    drawStoryLine();
  }

  drawStoryLine = function () {
    if (!storyLen) return;
    // In native scroll the SVG scrolls with the page; local mode needs a nudge.
    if (useLocalScroll && storylineEl) {
      storylineEl.style.transform = 'translateY(' + (-getScrollTop()) + 'px)';
    }
    // Draw the line as a smooth, uniform function of overall scroll progress so
    // it advances at a constant rate through every section — including the hero.
    // (Mapping to the viewport "read line" instead froze the draw while the hero
    // was on screen and parked the comet at the seam, which looked disconnected.)
    var maxScroll = getScrollMax();
    var atBottom = getScrollTop() >= maxScroll - 2;
    var prog = maxScroll > 0 ? getScrollTop() / maxScroll : 0;
    if (prog < 0) prog = 0; else if (prog > 1) prog = 1;
    // The *target* length for the current scroll position. The rendered length
    // (storyDrawn) eases toward it in a RAF loop so a batched wheel/trackpad
    // jump animates the line instead of snapping it forward all at once.
    storyTarget = atBottom ? storyLen : storyLen * prog;
    if (reduce) {
      storyDrawn = storyTarget;
      renderStoryLine(storyDrawn);
    } else if (!storyRAF) {
      storyRAF = requestAnimationFrame(stepStoryLine);
    }
    updateActiveChapter();
    syncGuideVisibility();
  };

  window.addEventListener('scroll', drawStoryLine, { passive: true });
  if (scrollRoot) scrollRoot.addEventListener('scroll', drawStoryLine, { passive: true });
  var storyResizeRAF;
  window.addEventListener('resize', function () {
    if (storyResizeRAF) cancelAnimationFrame(storyResizeRAF);
    storyResizeRAF = requestAnimationFrame(buildStoryline);
  });
  window.addEventListener('load', function () { window.setTimeout(buildStoryline, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { buildStoryline(); });
  buildStoryline();

  /* ----------------------------------------------------------------------
     4. Reveal on scroll
     ---------------------------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); revObs.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach(function (r) { revObs.observe(r); });

    // sections that trigger internal animation (dashboards)
    var animSections = document.querySelectorAll('[data-animate-in]');
    var animObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); animObs.unobserve(e.target); } });
    }, { threshold: 0.3 });
    animSections.forEach(function (s) { animObs.observe(s); });
  } else {
    reveals.forEach(function (r) { r.classList.add('is-in'); });
  }

  /* ----------------------------------------------------------------------
     5. Counters
     ---------------------------------------------------------------------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1600, start = null;
    function step(ts) {
      if (!start) start = ts;
      var k = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(2, -10 * k);
      var val = target * eased;
      el.textContent = (target >= 1000 ? Math.round(val / 100) / 10 + 'K' : Math.round(val)) + suffix;
      if (k < 1) requestAnimationFrame(step); else el.textContent = (target >= 1000 ? (target / 1000) + 'K' : target) + suffix;
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var cObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { animateCount(e.target); cObs.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cObs.observe(c); });
  }

  /* ----------------------------------------------------------------------
     6. Promo films — muted preview loops; click loads the full film w/ sound.
        Works for every .promo block on the page (hero promo, case study, …).
     ---------------------------------------------------------------------- */
  (function promoFilms() {
    document.querySelectorAll('.promo').forEach(function (promo) {
      var playBtn = promo.querySelector('.promo__play');
      if (!playBtn) return;
      var preview = promo.querySelector('.promo__preview');
      var youtubeUrl = promo.getAttribute('data-youtube');
      var loaded = false;

      function play() {
        if (youtubeUrl) {
          window.open(youtubeUrl, '_blank', 'noopener');
          return;
        }
        if (loaded) return;
        loaded = true;
        var isMobile = window.matchMedia('(max-width: 640px)').matches;
        var src = isMobile
          ? promo.getAttribute('data-src-mobile')
          : promo.getAttribute('data-src-desktop');
        if (!src) { loaded = false; return; }

        var full = document.createElement('video');
        full.className = 'promo__full';
        full.setAttribute('playsinline', '');
        full.controls = true;
        full.preload = 'auto';
        if (preview) full.poster = preview.getAttribute('poster') || '';
        full.src = src;
        full.addEventListener('ended', function () {
          promo.classList.remove('is-playing');
          if (full.parentNode) full.parentNode.removeChild(full);
          loaded = false;
          if (preview) { try { preview.play(); } catch (e) {} }
        });
        promo.appendChild(full);
        promo.classList.add('is-playing');
        if (preview) { try { preview.pause(); } catch (e) {} }
        var p = full.play();
        if (p && typeof p.catch === 'function') { p.catch(function () {}); }
      }

      playBtn.addEventListener('click', play);
    });
  })();

  /* ----------------------------------------------------------------------
     6b. Portfolio lightbox — click a case-study tile to open its story with
         the embedded YouTube video and full write-up.
     ---------------------------------------------------------------------- */
  (function portfolioLightbox() {
    var lightbox = document.getElementById('portfolioLightbox');
    if (!lightbox) return;
    var videoWrap = document.getElementById('lightboxVideo');
    var eyebrowEl = document.getElementById('lightboxEyebrow');
    var titleEl   = document.getElementById('lightboxTitle');
    var descEl    = document.getElementById('lightboxDesc');
    var ytLink    = document.getElementById('lightboxYoutube');
    var page      = lightbox.querySelector('.lightbox__page');
    var panel     = lightbox.querySelector('.lightbox__panel');
    var lastFocused = null;

    function closeLightbox() {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-open');
      document.querySelectorAll('body > :not(#portfolioLightbox)').forEach(function (el) { el.inert = false; });
      videoWrap.innerHTML = ''; // stop playback
      if (lastFocused) { lastFocused.focus({ preventScroll: true }); lastFocused = null; }
    }

    function openLightbox(card, fromHistory) {
      var videoId = card.getAttribute('data-video');
      var eyebrow = card.querySelector('.portfolio-card__caption span');
      var title   = card.querySelector('.portfolio-card__caption h3');
      var full    = card.querySelector('.portfolio-card__full');
      if (!videoId) return;

      eyebrowEl.textContent = eyebrow ? eyebrow.textContent : '';
      titleEl.textContent   = title ? title.textContent : '';
      descEl.innerHTML      = full ? full.innerHTML : '';
      if (ytLink) ytLink.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);

      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) + '?rel=0&autoplay=1';
      iframe.title = title ? title.textContent : 'Case study video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      videoWrap.innerHTML = '';
      videoWrap.appendChild(iframe);

      lastFocused = document.activeElement;
      if (page) page.scrollTop = 0;
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
      document.querySelectorAll('body > :not(#portfolioLightbox)').forEach(function (el) { el.inert = true; });
      lightbox.querySelector('.lightbox__close').focus({ preventScroll: true });

      // Give the case study a shareable URL (#work/<slug>) and a history entry
      // so the browser Back button (and Escape) returns to the page underneath.
      var slug = card.getAttribute('data-slug');
      if (!fromHistory && slug) {
        history.pushState({ dmLightbox: slug }, '', '#work/' + slug);
      }
    }

    var descBox   = document.getElementById('portfolioDesc');
    var descBrand = descBox && descBox.querySelector('.portfolio__desc-brand');
    var descHook  = descBox && descBox.querySelector('.portfolio__desc-hook');
    function showDesc(card) {
      if (!descBox) return;
      var brand = card.querySelector('.portfolio-card__caption span');
      var hook  = card.querySelector('.portfolio-card__caption h3');
      descBrand.textContent = brand ? brand.textContent : '';
      descHook.textContent  = hook ? hook.textContent : '';
      descBox.classList.add('is-active');
    }
    function hideDesc() { if (descBox) descBox.classList.remove('is-active'); }

    var cardsBySlug = {};
    document.querySelectorAll('.portfolio-card').forEach(function (card) {
      var trigger = card.querySelector('.portfolio-card__trigger');
      if (!trigger) return;
      var slug = card.getAttribute('data-slug');
      if (slug) cardsBySlug[slug] = card;
      trigger.addEventListener('click', function () { openLightbox(card); });
      card.addEventListener('mouseenter', function () { showDesc(card); });
      card.addEventListener('mouseleave', hideDesc);
      card.addEventListener('focusin', function () { showDesc(card); });
      card.addEventListener('focusout', hideDesc);
    });

    // ---- Routing: #work/<slug> ------------------------------------------
    function slugFromHash() {
      var m = location.hash.match(/^#work\/(.+)$/);
      return m ? decodeURIComponent(m[1]) : null;
    }
    // Close requested by the user (button / Escape). Prefer stepping back in
    // history so the URL unwinds cleanly; fall back to a direct close when this
    // view was opened straight from a shared link.
    function requestClose() {
      if (!lightbox.classList.contains('is-open')) return;
      if (history.state && history.state.dmLightbox) {
        history.back(); // popstate handler performs the actual close
      } else {
        if (slugFromHash()) history.replaceState(null, '', location.pathname + location.search);
        closeLightbox();
      }
    }
    window.addEventListener('popstate', function () {
      var slug = slugFromHash();
      if (slug && cardsBySlug[slug]) {
        if (!lightbox.classList.contains('is-open')) openLightbox(cardsBySlug[slug], true);
      } else if (lightbox.classList.contains('is-open')) {
        closeLightbox();
      }
    });

    lightbox.querySelectorAll('[data-lightbox-close]').forEach(function (el) {
      el.addEventListener('click', requestClose);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('is-open')) requestClose();
      if (e.key !== 'Tab' || !lightbox.classList.contains('is-open')) return;
      var focusable = Array.prototype.slice.call(lightbox.querySelectorAll('button, [href], iframe, [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    if (panel) {
      panel.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    // Open directly when the page is loaded on a shared #work/<slug> URL.
    (function openFromInitialHash() {
      var slug = slugFromHash();
      if (slug && cardsBySlug[slug]) openLightbox(cardsBySlug[slug], true);
    })();
  })();

  /* ----------------------------------------------------------------------
     6c. Portfolio horizontal strip — vertical wheel is mapped onto horizontal
         scroll (tiles glide sideways, slightly tilted toward the direction of
         travel) until an end is reached, at which point the page resumes
         scrolling vertically. Trackpad swipes and click-drag also scroll it
         left/right freely.
     ---------------------------------------------------------------------- */
  (function portfolioStrip() {
    var vp = document.getElementById('portfolioViewport');
    var track = document.getElementById('portfolioTrack');
    if (!vp || !track) return;

    function maxScroll() { return vp.scrollWidth - vp.clientWidth; }

    // Eased horizontal scroll: wheel/keys nudge a target and a RAF loop glides
    // scrollLeft toward it, so the strip keeps moving smoothly instead of
    // snapping to a halt after each wheel tick.
    var target = vp.scrollLeft;
    var raf = null;
    function ease() {
      var diff = target - vp.scrollLeft;
      if (Math.abs(diff) < 0.5) { vp.scrollLeft = target; raf = null; return; }
      vp.scrollLeft += diff * 0.22;
      raf = requestAnimationFrame(ease);
    }
    function glideTo(x) {
      target = Math.max(0, Math.min(x, maxScroll()));
      if (raf === null) raf = requestAnimationFrame(ease);
    }

    // Lean the sleeves toward the direction of travel, then ease back to rest.
    var tilt = 0, tiltRAF = null;
    function decayTilt() {
      tilt *= 0.86;
      if (Math.abs(tilt) < 0.05) { tilt = 0; tiltRAF = null; }
      track.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
      if (tiltRAF !== null) tiltRAF = requestAnimationFrame(decayTilt);
    }
    function nudgeTilt(delta) {
      if (reduce) return;
      tilt = Math.max(-6, Math.min(6, tilt + delta * 0.015));
      track.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
      if (tiltRAF === null) tiltRAF = requestAnimationFrame(decayTilt);
    }

    // Wheel: dominant-vertical wheel drives horizontal motion. Only consume
    // (and block the page) while the strip can still move that way; at either
    // end, let the event through so the page resumes vertical scrolling.
    vp.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { nudgeTilt(e.deltaX); return; }
      var max = maxScroll();
      if (max <= 0) return;
      var goingRight = e.deltaY > 0;
      var atStart = target <= 0;
      var atEnd = target >= max - 1;
      if ((goingRight && !atEnd) || (!goingRight && !atStart)) {
        glideTo(target + e.deltaY);
        nudgeTilt(e.deltaY);
        e.preventDefault();
        e.stopPropagation(); // keep the page (native + virtual) from scrolling
      }
    }, { passive: false });

    // Keep the target in sync when the strip is scrolled by other means
    // (trackpad swipe, scrollbar) so wheel handoff stays accurate.
    vp.addEventListener('scroll', function () {
      if (raf === null) target = vp.scrollLeft;
      nudgeTilt(0);
    }, { passive: true });

    // Click-drag to pan (pointer devices).
    var dragging = false, startX = 0, startLeft = 0, moved = false;
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return; // native touch handles panning
      dragging = true; moved = false;
      startX = e.clientX; startLeft = vp.scrollLeft;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      target = vp.scrollLeft;
      vp.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      vp.scrollLeft = startLeft - dx;
      target = vp.scrollLeft;
      nudgeTilt(-dx * 0.3);
    });
    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      vp.classList.remove('is-dragging');
    });
    // Swallow the click that ends a drag so it doesn't open a case study.
    vp.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  })();

  /* ----------------------------------------------------------------------
     7. Smooth anchor scroll
     ---------------------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      // Use the full offset chain (getStaticTop) rather than the raw offsetTop,
      // which is only relative to the nearest positioned ancestor — that made
      // nested targets like #contact scroll to the wrong place.
      var top = (useLocalScroll || useVirtualScroll) && scrollRoot
        ? getStaticTop(t) - 70
        : t.getBoundingClientRect().top + window.scrollY - 70;
      scrollToY(top);
    });
  });
})();
