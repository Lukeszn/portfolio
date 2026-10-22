(() => {
  const intro = document.getElementById('intro');
  const stage = document.getElementById('stage');
  const tilt = document.getElementById('tilt');
  const stack = document.getElementById('stack');
  const layers = [...stack.querySelectorAll('.layer')];
  const tags = stack.querySelectorAll('.tag');
  const [grid, wire, surf, type, inter] = layers;
  const stepName = document.getElementById('stepName');
  const stepCount = document.getElementById('stepCount');
  const bar = document.getElementById('bar');
  const cursor = document.getElementById('cursor');
  const ripple = document.getElementById('ripple');
  const halo = document.getElementById('halo');
  const words = document.getElementById('headline');
  const names = ['Grid', 'Wireframe', 'Surfaces', 'Type', 'Interaction'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = () => matchMedia('(max-width: 700px)').matches;

  // Split headline into words for a per-word rise once the type layer lands
  words.innerHTML = words.textContent.trim().split(' ')
    .map(w => `<span class="w">${w}</span>`).join(' ');
  const wordEls = words.querySelectorAll('.w');

  const setStep = (i, label) => {
    stepName.textContent = label || names[i];
    stepCount.textContent = label ? '5 of 5 layers' : `${i + 1} of 5 layers`;
  };

  let tl;
  const build = () => {
    if (tl) tl.kill();
    intro.classList.remove('done');
    const gap = stage.offsetWidth * (isPhone() ? 0.16 : 0.1);
    const angle = isPhone() ? { rx: 52, rz: -24, s: 0.6 } : { rx: 58, rz: -34, s: 0.52 };

    gsap.set(stack, { rotationX: angle.rx, rotationZ: angle.rz, scale: angle.s, y: isPhone() ? '-2%' : '6%' });
    gsap.set(layers, { z: -700, opacity: 0 });
    gsap.set(tags, { opacity: 1 });
    gsap.set('#shadow', { opacity: 0 });
    gsap.set(cursor, { left: '72%', top: '96%', opacity: 0 });
    gsap.set([ripple, halo], { opacity: 0, scale: 0.6 });
    gsap.set(wordEls, { yPercent: 0, opacity: 1 });
    gsap.set('.b-btn1', { scale: 1 });
    gsap.set(bar, { scaleX: 0 });
    setStep(0);

    tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    tl.to('#shadow', { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
    // Slow orbit while the layers arrive
    tl.to(stack, { rotationZ: angle.rz + 12, duration: 3.6, ease: 'sine.inOut' }, 0);

    layers.forEach((layer, i) => {
      const at = 0.25 + i * 0.42;
      tl.to(layer, { z: i * gap, opacity: 1, duration: 1.1 }, at);
      tl.call(() => setStep(i), null, at);
      tl.to(bar, { scaleX: (i + 1) / 6, duration: 0.5, ease: 'power2.out' }, at);
      if (i === 3) tl.from(wordEls, { yPercent: 60, opacity: 0, duration: 0.8, stagger: 0.06 }, at + 0.15);
    });

    // Collapse: the exploded view becomes the finished page
    const c = 2.75;
    tl.addLabel('collapse', c + 0.5);
    tl.call(() => setStep(4, 'Assembling'), null, 'collapse');
    tl.to(tags, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 'collapse');
    tl.to(layers, { z: i => i * 0.6, duration: 1.6, ease: 'expo.inOut' }, 'collapse');
    tl.to(stack, { rotationX: 0, rotationZ: 0, scale: 1, y: 0, duration: 1.6, ease: 'expo.inOut' }, 'collapse');
    tl.to('#shadow', { opacity: 0, duration: 1 }, 'collapse+=0.6');
    tl.to([grid, wire], { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, 'collapse+=0.9');
    tl.to(bar, { scaleX: 1, duration: 1.6, ease: 'expo.inOut' }, 'collapse');

    // The cursor clicks the primary call to action
    const btnPos = isPhone() ? { left: '24%', top: '46.6%' } : { left: '10.6%', top: '67.6%' };
    tl.to(cursor, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 'collapse+=1.7');
    tl.to(cursor, { ...btnPos, duration: 0.9, ease: 'power3.inOut' }, 'collapse+=1.7');
    tl.to(halo, { opacity: 1, scale: 1, duration: 0.5 }, '>-0.15');
    tl.to('.b-btn1', { scale: 0.96, duration: 0.1, ease: 'power2.out' });
    tl.to(cursor, { scale: 0.88, duration: 0.1, ease: 'power2.out' }, '<');
    tl.fromTo(ripple, { opacity: 0.9, scale: 0.4 }, { opacity: 0, scale: 2.2, duration: 0.7, ease: 'power2.out' }, '<');
    tl.to(['.b-btn1', cursor], { scale: 1, duration: 0.35, ease: 'back.out(3)' }, '<0.1');
    tl.to(halo, { opacity: 0, duration: 0.8, ease: 'power2.out' }, '>0.3');
    tl.to(cursor, { opacity: 0, x: '60%', y: '40%', duration: 0.6, ease: 'power2.in' }, '<');
    tl.call(() => { setStep(4, 'Live'); stepCount.textContent = 'Built in 5 layers'; intro.classList.add('done'); });

    if (reduced) tl.progress(1);
  };

  // Pointer parallax on a separate wrapper so it never fights the timeline
  let tx = 0, ty = 0, cx = 0, cy = 0;
  addEventListener('pointermove', e => {
    tx = (e.clientX / innerWidth - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
  });
  const loop = () => {
    const amp = intro.classList.contains('done') ? 3 : 7;
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    tilt.style.transform = `rotateX(${(-cy * amp).toFixed(2)}deg) rotateY(${(cx * amp).toFixed(2)}deg)`;
    requestAnimationFrame(loop);
  };
  if (!reduced) requestAnimationFrame(loop);

  document.getElementById('skip').addEventListener('click', () => tl && tl.progress(1));
  document.getElementById('replay').addEventListener('click', build);
  let lastPhone = isPhone();
  addEventListener('resize', () => {
    if (isPhone() !== lastPhone) { lastPhone = isPhone(); build(); }
  });

  const start = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(build);
  if (window.gsap) start();
  else {
    // GSAP failed to load: show the finished page without motion
    intro.classList.add('done', 'static');
    setStep(4, 'Live');
  }
})();
