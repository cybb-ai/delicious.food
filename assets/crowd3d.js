/* 3D storefront scene: people walk along the sidewalk and enter / leave the shop. Requires THREE (r149). */
(function () {
  var box = document.getElementById('crowd3d');
  if (!box || !window.THREE) return;
  var T = THREE, renderer;
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { box.style.display = 'none'; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  box.appendChild(renderer.domElement);

  var scene = new T.Scene();
  var FOV = 30, CAM_Z = 13;
  var camera = new T.PerspectiveCamera(FOV, 5, 0.1, 100);
  camera.position.set(0, 2.5, CAM_Z);
  camera.lookAt(0, 1.55, 0);

  /* lights */
  scene.add(new T.HemisphereLight(0xfff1de, 0x6b5545, 0.95));
  var sun = new T.DirectionalLight(0xffe2bd, 1.0);
  sun.position.set(-6, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  scene.add(sun); scene.add(sun.target);
  var doorLight = new T.PointLight(0xffb86b, 1.1, 5, 2);
  doorLight.position.set(0, 1.4, 1.2);
  scene.add(doorLight);

  function std(c, o) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o || {})); }

  /* ground */
  var walk = new T.Mesh(new T.BoxGeometry(120, 0.12, 5.2), std(0x8a7a69));
  walk.position.set(0, -0.06, 2.4); walk.receiveShadow = true; scene.add(walk);
  var curb = new T.Mesh(new T.BoxGeometry(120, 0.16, 0.18), std(0x6d5f51));
  curb.position.set(0, -0.04, 5.1); curb.receiveShadow = true; scene.add(curb);
  var road = new T.Mesh(new T.BoxGeometry(120, 0.1, 8), std(0x4a3d35));
  road.position.set(0, -0.1, 9.2); road.receiveShadow = true; scene.add(road);

  /* shop */
  var shop = new T.Group(); scene.add(shop);
  var W = 6.4, H = 3.7, D = 3.2;
  var body = new T.Mesh(new T.BoxGeometry(W, H, D), std(0xf8f4ec));
  body.position.set(0, H / 2, -D / 2); body.castShadow = body.receiveShadow = true; shop.add(body);
  var plinth = new T.Mesh(new T.BoxGeometry(W + 0.1, 0.35, 0.06), std(0x38271f));
  plinth.position.set(0, 0.175, 0.03); shop.add(plinth);
  var roof = new T.Mesh(new T.BoxGeometry(W + 0.3, 0.2, D + 0.3), std(0x38271f));
  roof.position.set(0, H + 0.1, -D / 2); roof.castShadow = true; shop.add(roof);

  var glow = new T.MeshBasicMaterial({ color: 0xffd9a0 });
  var frameMat = std(0x38271f);
  [-2.15, 2.15].forEach(function (x) {
    var fr = new T.Mesh(new T.BoxGeometry(1.9, 1.35, 0.05), frameMat); fr.position.set(x, 1.55, 0.02); shop.add(fr);
    var gl = new T.Mesh(new T.PlaneGeometry(1.7, 1.15), glow); gl.position.set(x, 1.55, 0.06); shop.add(gl);
    var bar = new T.Mesh(new T.BoxGeometry(0.05, 1.15, 0.03), frameMat); bar.position.set(x, 1.55, 0.075); shop.add(bar);
  });
  var doorFrame = new T.Mesh(new T.BoxGeometry(1.5, 2.45, 0.05), frameMat); doorFrame.position.set(0, 1.225, 0.02); shop.add(doorFrame);
  var inside = new T.Mesh(new T.PlaneGeometry(1.3, 2.3), new T.MeshBasicMaterial({ color: 0xffc27a })); inside.position.set(0, 1.2, 0.06); shop.add(inside);
  var hinge = new T.Group(); hinge.position.set(-0.65, 0, 0.1); shop.add(hinge);
  var leaf = new T.Mesh(new T.BoxGeometry(1.3, 2.3, 0.06), std(0xbd6b37)); leaf.position.set(0.65, 1.2, 0); leaf.castShadow = true; hinge.add(leaf);
  var pane = new T.Mesh(new T.PlaneGeometry(0.8, 1.2), glow); pane.position.set(0.65, 1.5, 0.04); hinge.add(pane);

  /* striped awning */
  var aw = new T.Group(); aw.position.set(0, 3.0, 0.5); aw.rotation.x = 0.38; shop.add(aw);
  var n = 10, sw = (W + 0.4) / n;
  for (var i = 0; i < n; i++) {
    var s = new T.Mesh(new T.BoxGeometry(sw, 0.08, 1.15), std(i % 2 ? 0xf8f4ec : 0xbd6b37));
    s.position.x = -((W + 0.4) / 2) + sw * (i + 0.5); s.castShadow = true; aw.add(s);
  }

  /* sign */
  var cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  var cx = cv.getContext('2d');
  cx.fillStyle = '#38271f'; cx.fillRect(0, 0, 1024, 256);
  cx.strokeStyle = '#f2bd89'; cx.lineWidth = 6; cx.strokeRect(14, 14, 996, 228);
  cx.fillStyle = '#f2bd89'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.font = '700 130px "Noto Serif TC", serif'; cx.fillText('煎好日', 512, 112);
  cx.font = '600 34px "DM Sans", sans-serif'; cx.fillText('J I A N   G O O D   D A Y', 512, 208);
  var tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding;
  var sign = new T.Mesh(new T.PlaneGeometry(2.6, 0.65), new T.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, 3.45, 0.07); shop.add(sign);
  /* repaint once the web font is ready */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
    cx.fillStyle = '#38271f'; cx.fillRect(0, 0, 1024, 256);
    cx.strokeStyle = '#f2bd89'; cx.strokeRect(14, 14, 996, 228);
    cx.fillStyle = '#f2bd89';
    cx.font = '700 130px "Noto Serif TC", serif'; cx.fillText('煎好日', 512, 112);
    cx.font = '600 34px "DM Sans", sans-serif'; cx.fillText('J I A N   G O O D   D A Y', 512, 208);
    tex.needsUpdate = true;
  });

  /* lantern + potted plants */
  [-3.6, 3.6].forEach(function (x) {
    var pot = new T.Mesh(new T.CylinderGeometry(0.28, 0.2, 0.45, 12), std(0x99512b)); pot.position.set(x, 0.225, 0.45); pot.castShadow = true; shop.add(pot);
    var bush = new T.Mesh(new T.SphereGeometry(0.38, 12, 10), std(0x5d7a45)); bush.position.set(x, 0.75, 0.45); bush.castShadow = true; shop.add(bush);
  });

  /* people */
  var gTorso = new T.CylinderGeometry(0.2, 0.24, 0.62, 8), gHead = new T.SphereGeometry(0.16, 12, 10),
    gHair = new T.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    gLeg = new T.BoxGeometry(0.13, 0.8, 0.15), gArm = new T.BoxGeometry(0.09, 0.56, 0.1),
    gBag = new T.BoxGeometry(0.22, 0.26, 0.12);
  var shirts = [0xbd6b37, 0xf2bd89, 0x5d7a45, 0xc9503c, 0x4f7a9a, 0xe0a63a, 0x8a5a9a, 0xf8f4ec];
  var skins = [0xf1c9a5, 0xd9a577, 0xb97c52, 0x8d5a3b];
  var pants = [0x38271f, 0x2f3a4a, 0x4b4036, 0x25282d];
  var hairs = [0x1d1511, 0x3b2a20, 0x6b4a2f, 0x111111];
  var bagMat = std(0xbd6b37);
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function limb(geo, mat, y, x, drop) {
    var g = new T.Group(); g.position.set(x, y, 0);
    var m = new T.Mesh(geo, mat); m.position.y = -drop; m.castShadow = true; g.add(m); return g;
  }
  function makePerson() {
    var root = new T.Group(), inner = new T.Group(); root.add(inner);
    var shirt = std(pick(shirts)), skin = std(pick(skins)), pant = std(pick(pants));
    var torso = new T.Mesh(gTorso, shirt); torso.position.y = 1.15; torso.castShadow = true; inner.add(torso);
    var head = new T.Mesh(gHead, skin); head.position.y = 1.64; head.castShadow = true; inner.add(head);
    var hair = new T.Mesh(gHair, std(pick(hairs))); hair.position.y = 1.66; hair.rotation.x = -0.25; inner.add(hair);
    var p = { root: root, inner: inner,
      legL: limb(gLeg, pant, 0.82, -0.1, 0.4), legR: limb(gLeg, pant, 0.82, 0.1, 0.4),
      armL: limb(gArm, shirt, 1.42, -0.29, 0.28), armR: limb(gArm, shirt, 1.42, 0.29, 0.28) };
    inner.add(p.legL, p.legR, p.armL, p.armR);
    p.bag = new T.Mesh(gBag, bagMat); p.bag.position.set(0.02, -0.64, 0.05); p.bag.castShadow = true; p.armR.add(p.bag);
    var sc = 0.92 + Math.random() * 0.2; root.scale.setScalar(sc);
    root.visible = false; scene.add(root);
    return p;
  }

  var halfW = 18, sx = 8, people = [], N = 10, doorOpen = 0;
  for (var k = 0; k < N; k++) { var pp = makePerson(); pp.wait = Math.random() * 6; pp.active = false; people.push(pp); }

  function layout() {
    var w = box.clientWidth || 800, h = box.clientHeight || 200;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    halfW = Math.tan(FOV * Math.PI / 360) * CAM_Z * camera.aspect;
    sx = Math.max(0, Math.min(halfW * 0.56, halfW - 3.6));
    shop.position.x = sx;
    doorLight.position.x = sx;
    var sc = sun.shadow.camera; sc.left = -halfW - 4; sc.right = halfW + 4; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40; sc.updateProjectionMatrix();
    sun.position.set(-6, 9, 7); sun.target.position.set(0, 0, 1);
  }

  function spawn(p) {
    var inbound = Math.random() < 0.62, side = Math.random() < 0.5 ? -1 : 1, lane = 1.5 + Math.random() * 2.5;
    var dx = sx + (Math.random() - 0.5) * 0.4, edge = side * (halfW + 1.6);
    p.speed = 1.3 + Math.random() * 0.8; p.phase = Math.random() * 6; p.inbound = inbound; p.seg = 0;
    p.bag.visible = !inbound;
    if (inbound) {
      p.path = [[edge, lane], [dx, lane], [dx, 0.1]];
      p.root.position.set(edge, 0, lane);
    } else {
      p.path = [[dx, 1.5 + Math.random() * 0.8], [side * (halfW + 1.6), lane]];
      p.root.position.set(dx, 0, 0.2);
    }
    p.dir = Math.atan2(p.path[0][0] - p.root.position.x, p.path[0][1] - p.root.position.z);
    p.root.rotation.y = p.dir; p.root.visible = true; p.active = true;
  }

  function angleLerp(a, b, t) { var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; }

  function step(dt) {
    var near = false;
    people.forEach(function (p) {
      if (!p.active) { p.wait -= dt; if (p.wait <= 0) spawn(p); return; }
      var pos = p.root.position, tgt = p.path[p.seg];
      var vx = tgt[0] - pos.x, vz = tgt[1] - pos.z, dist = Math.hypot(vx, vz), mv = p.speed * dt;
      if (dist <= mv) {
        pos.x = tgt[0]; pos.z = tgt[1]; p.seg++;
        if (p.seg >= p.path.length) { p.active = false; p.root.visible = false; p.wait = 0.4 + Math.random() * 3.5; return; }
      } else { pos.x += vx / dist * mv; pos.z += vz / dist * mv; }
      var want = Math.atan2(vx, vz);
      p.root.rotation.y = angleLerp(p.root.rotation.y, want, Math.min(1, dt * 8));
      if (p.inbound && pos.z < 0.22) { p.active = false; p.root.visible = false; p.wait = 0.5 + Math.random() * 3; return; }
      p.phase += dt * p.speed * 5.2;
      var sw = Math.sin(p.phase);
      p.legL.rotation.x = sw * 0.75; p.legR.rotation.x = -sw * 0.75;
      p.armL.rotation.x = -sw * 0.65; p.armR.rotation.x = p.bag.visible ? -0.25 : sw * 0.65;
      p.inner.position.y = Math.abs(sw) * 0.045;
      if (Math.abs(pos.x - sx) < 1.9 && pos.z < 2.2) near = true;
    });
    doorOpen += ((near ? 1 : 0) - doorOpen) * Math.min(1, dt * 5);
    hinge.rotation.y = -doorOpen * 1.25;
    doorLight.intensity = 0.9 + doorOpen * 0.9;
  }

  var running = false, visible = true, last = 0;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    step(dt); renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function update() {
    var should = visible && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    else if (!should) running = false;
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; update(); }).observe(box);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', layout);
  layout();
  /* warm start so the street is already busy */
  for (var w0 = 0; w0 < 240; w0++) step(0.05);
  renderer.render(scene, camera);
  update();
})();
