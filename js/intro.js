// Homepage intro: the hero assembles from five exploded layers, then the overlay fades to reveal the real page.
(() => {
  const intro = document.getElementById('li-intro');
  if (!intro) return;

  const $ = id => document.getElementById(id);
  const stage = $('li-stage');
  const tilt = $('li-tilt');
  const stack = $('li-stack');
  const layers = [...stack.querySelectorAll('.li-layer')];
  const tags = stack.querySelectorAll('.li-tag');
  const [grid, wire] = layers;
  const stepName = $('li-stepName');
  const stepCount = $('li-stepCount');
  const bar = $('li-bar');
  const cursor = $('li-cursor');
  const ripple = $('li-ripple');
  const halo = $('li-halo');
  const shadow = $('li-shadow');
  const headline = $('li-headline');
  const btn1 = stack.querySelectorAll('.li-b-btn1');
  const names = ['Grid', 'Wireframe', 'Surfaces', 'Type', 'Interaction'];
  const isPhone = () => matchMedia('(max-width: 700px)').matches;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try { sessionStorage.setItem('ls-intro-seen', '1'); } catch (e) { /* ignore */ }
    document.documentElement.classList.remove('li-lock');
    intro.classList.add('li-leaving');
    setTimeout(() => { intro.remove(); if (window.gsap && tl) tl.kill(); }, 800);
  };

  // Without GSAP, skip straight to the page
  if (!window.gsap) { close(); return; }

  headline.innerHTML = headline.textContent.trim().split(' ')
    .map(w => `<span class="li-w">${w}</span>`).join(' ');
  const wordEls = headline.querySelectorAll('.li-w');

  const setStep = (i, label) => {
    stepName.textContent = label || names[i];
    stepCount.textContent = `${i + 1} of 5 layers`;
  };

  let tl;
  const build = () => {
    if (tl) tl.kill();
    const phone = isPhone();
    const gap = stage.offsetWidth * (phone ? 0.16 : 0.1);
    const angle = phone ? { rx: 52, rz: -24, s: 0.6 } : { rx: 58, rz: -34, s: 0.52 };

    gsap.set(stack, { rotationX: angle.rx, rotationZ: angle.rz, scale: angle.s, y: phone ? '-2%' : '6%' });
    gsap.set(layers, { z: -700, opacity: 0 });
    gsap.set(tags, { opacity: 1 });
    gsap.set(shadow, { opacity: 0 });
    gsap.set(cursor, { left: '72%', top: '96%', opacity: 0, x: 0, y: 0, scale: 1 });
    gsap.set([ripple, halo], { opacity: 0, scale: 0.6 });
    gsap.set(btn1, { scale: 1 });
    gsap.set(bar, { scaleX: 0 });
    setStep(0);

    tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(shadow, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
    tl.to(stack, { rotationZ: angle.rz + 12, duration: 3.6, ease: 'sine.inOut' }, 0);

    layers.forEach((layer, i) => {
      const at = 0.25 + i * 0.42;
      tl.to(layer, { z: i * gap, opacity: 1, duration: 1.1 }, at);
      tl.call(() => setStep(i), null, at);
      tl.to(bar, { scaleX: (i + 1) / 6, duration: 0.5, ease: 'power2.out' }, at);
      if (i === 3) tl.from(wordEls, { yPercent: 60, opacity: 0, duration: 0.8, stagger: 0.06 }, at + 0.15);
    });

    tl.addLabel('collapse', 3.25);
    tl.call(() => setStep(4, 'Assembling'), null, 'collapse');
    tl.to(tags, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 'collapse');
    tl.to(layers, { z: i => i * 0.6, duration: 1.6, ease: 'expo.inOut' }, 'collapse');
    tl.to(stack, { rotationX: 0, rotationZ: 0, scale: 1, y: 0, duration: 1.6, ease: 'expo.inOut' }, 'collapse');
    tl.to(shadow, { opacity: 0, duration: 1 }, 'collapse+=0.6');
    tl.to([grid, wire], { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, 'collapse+=0.9');
    tl.to(bar, { scaleX: 1, duration: 1.6, ease: 'expo.inOut' }, 'collapse');

    const btnPos = phone ? { left: '24%', top: '46.6%' } : { left: '10.6%', top: '67.6%' };
    tl.to(cursor, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 'collapse+=1.7');
    tl.to(cursor, { ...btnPos, duration: 0.9, ease: 'power3.inOut' }, 'collapse+=1.7');
    tl.to(halo, { opacity: 1, scale: 1, duration: 0.5 }, '>-0.15');
    tl.to(btn1, { scale: 0.96, duration: 0.1, ease: 'power2.out' });
    tl.to(cursor, { scale: 0.88, duration: 0.1, ease: 'power2.out' }, '<');
    tl.fromTo(ripple, { opacity: 0.9, scale: 0.4 }, { opacity: 0, scale: 2.2, duration: 0.7, ease: 'power2.out' }, '<');
    tl.to([...btn1, cursor], { scale: 1, duration: 0.35, ease: 'back.out(3)' }, '<0.1');
    tl.to(halo, { opacity: 0, duration: 0.8, ease: 'power2.out' }, '>0.3');
    tl.to(cursor, { opacity: 0, x: '60%', y: '40%', duration: 0.6, ease: 'power2.in' }, '<');
    tl.call(() => { setStep(4, 'Live'); intro.classList.add('li-done'); });
    tl.call(close, null, '+=0.5');
  };

  // Pointer parallax on its own wrapper so it never fights the timeline
  let tx = 0, ty = 0, cx = 0, cy = 0;
  const onMove = e => {
    tx = (e.clientX / innerWidth - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
  };
  addEventListener('pointermove', onMove);
  const loop = () => {
    if (closed) { removeEventListener('pointermove', onMove); return; }
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    tilt.style.transform = `rotateX(${(-cy * 7).toFixed(2)}deg) rotateY(${(cx * 7).toFixed(2)}deg)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  $('li-skip').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // The mock buttons are real links: dismiss the overlay and let the anchor scroll
  intro.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', close));

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(build);
})();
