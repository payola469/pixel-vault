'use strict';

const get = id => document.getElementById(id);
const preview = get('preview');
const thumbnailContext = { palette: 'original', mirror: false, seed: 173 };
const images = new Map();
let local = [];
let published = [];
let selected = effects[0];
let filter = '';
let frame = 0;
let playing = true;
let lastFrame = performance.now();
let seed = thumbnailContext.seed;

function status(message) {
  get('status').textContent = message;
}

function assets() {
  return [...effects, ...new Map([...published, ...local].map(asset => [asset.id, asset])).values()];
}

function renderFrame(canvas, asset, index, options) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (options.mirror) {
    ctx.translate(asset.width, 0);
    ctx.scale(-1, 1);
  }
  if (asset.style) {
    drawEffect(ctx, asset, index, palettes[options.palette] || asset.colors, options.seed);
  } else {
    const image = images.get(asset.image);
    const columns = image.width / asset.width;
    ctx.drawImage(image, (index % columns) * asset.width, Math.floor(index / columns) * asset.height,
      asset.width, asset.height, 0, 0, asset.width, asset.height);
  }
  ctx.restore();
}

function gallery() {
  const all = assets();
  const categories = [...new Set(all.map(asset => asset.category))];
  if (filter && !categories.includes(filter)) filter = '';
  get('filters').replaceChildren(...['', ...categories].map(category => {
    const button = document.createElement('button');
    button.textContent = category || 'All';
    button.setAttribute('aria-pressed', String(filter === category));
    button.onclick = () => { filter = category; gallery(); };
    return button;
  }));
  const query = get('search').value.trim().toLowerCase();
  const visible = all.filter(asset =>
    (!filter || filter === asset.category) && `${asset.name} ${asset.category}`.toLowerCase().includes(query));
  get('count').textContent = `${visible.length} / ${all.length}`;
  if (!visible.length) {
    const message = document.createElement('p');
    message.textContent = 'ไม่พบเอฟเฟกต์';
    get('gallery').replaceChildren(message);
    return;
  }
  get('gallery').replaceChildren(...visible.map(asset => {
    const card = document.createElement('button');
    card.className = 'card';
    card.title = asset.name;
    card.setAttribute('aria-pressed', String(asset.id === selected.id));
    const thumb = document.createElement('canvas');
    thumb.width = asset.width;
    thumb.height = asset.height;
    thumb.setAttribute('aria-hidden', 'true');
    renderFrame(thumb, asset, Math.floor(asset.frames * .45), thumbnailContext);
    const name = document.createElement('span');
    name.textContent = asset.name;
    card.append(thumb, name);
    card.onclick = () => {
      select(asset);
      get('gallery').querySelectorAll('.card').forEach(button => button.setAttribute('aria-pressed', String(button === card)));
    };
    return card;
  }));
}

function options() {
  return { mirror: get('mirror').checked, palette: get('palette').value, seed };
}

function draw() {
  renderFrame(preview, selected, frame, options());
  get('frame').value = frame;
  get('frame-number').textContent = `${frame + 1} / ${selected.frames}`;
}

function setPlaying(value) {
  playing = value;
  get('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
  lastFrame = performance.now();
}

function select(asset) {
  selected = asset;
  get('title').textContent = asset.name;
  get('category').textContent = asset.category;
  get('spec').textContent = `${asset.width} × ${asset.height} px · ${asset.frames} frames`;
  preview.width = asset.width;
  preview.height = asset.height;
  get('frame').max = asset.frames - 1;
  get('fps').value = asset.fps;
  get('loop').checked = asset.loop;
  get('mirror').checked = false;
  get('palette').value = 'original';
  get('palette').disabled = get('seed').disabled = !asset.style;
  get('remove').hidden = !local.some(item => item.id === asset.id);
  seed = thumbnailContext.seed;
  frame = 0;
  setPlaying(true);
  draw();
}

function tick(now) {
  const interval = 1000 / (get('fps').valueAsNumber || selected.fps);
  const steps = Math.floor((now - lastFrame) / interval);
  if (playing && steps > 0) {
    const next = frame + steps;
    if (get('loop').checked) {
      frame = next % selected.frames;
    } else {
      frame = Math.min(selected.frames - 1, next);
      if (next >= selected.frames) setPlaying(false);
    }
    lastFrame = now - ((now - lastFrame) % interval);
    draw();
  }
  requestAnimationFrame(tick);
}

function buildSheet(canvas, asset, settings) {
  const columns = Math.min(8, asset.frames);
  canvas.width = columns * asset.width;
  canvas.height = Math.ceil(asset.frames / columns) * asset.height;
  const cell = document.createElement('canvas');
  cell.width = asset.width;
  cell.height = asset.height;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < asset.frames; i++) {
    renderFrame(cell, asset, i, settings);
    ctx.drawImage(cell, (i % columns) * asset.width, Math.floor(i / columns) * asset.height);
  }
  return columns;
}

function download(name, blob) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const encoder = new TextEncoder();
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  return n >>> 0;
});

function zip(files) {
  const locals = [];
  const directories = [];
  let offset = 0;
  let directorySize = 0;
  for (const [filename, bytes] of files) {
    const name = encoder.encode(filename);
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(12, 33, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, bytes.length, true);
    localHeader.setUint32(22, bytes.length, true);
    localHeader.setUint16(26, name.length, true);
    locals.push(localHeader.buffer, name, bytes);

    const directory = new DataView(new ArrayBuffer(46));
    directory.setUint32(0, 0x02014b50, true);
    directory.setUint16(4, 20, true);
    directory.setUint16(6, 20, true);
    directory.setUint16(14, 33, true);
    directory.setUint32(16, crc, true);
    directory.setUint32(20, bytes.length, true);
    directory.setUint32(24, bytes.length, true);
    directory.setUint16(28, name.length, true);
    directory.setUint32(42, offset, true);
    directories.push(directory.buffer, name);
    directorySize += directory.byteLength + name.length;
    offset += localHeader.byteLength + name.length + bytes.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...locals, ...directories, end.buffer], { type: 'application/zip' });
}

async function exportUnity() {
  if (!get('fps').reportValidity() || !get('ppu').reportValidity()) return;
  const asset = selected;
  const name = asset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || asset.id;
  const stem = asset.style ? name : `${name}-${asset.id.slice(-8)}`;
  const canvas = document.createElement('canvas');
  const columns = buildSheet(canvas, asset, options());
  const metadata = {
    version: 1,
    image: `${stem}.png`,
    width: asset.width,
    height: asset.height,
    frames: asset.frames,
    columns,
    fps: get('fps').valueAsNumber,
    ppu: get('ppu').valueAsNumber,
    loop: get('loop').checked
  };
  try {
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('สร้าง PNG ไม่สำเร็จ');
    download(`${stem}-unity.zip`, zip([
      [metadata.image, new Uint8Array(await png.arrayBuffer())],
      [`${stem}.pixelvault.json`, encoder.encode(JSON.stringify(metadata, null, 2))]
    ]));
    status('ส่งออก PNG และข้อมูลเฟรมสำหรับ Unity แล้ว');
  } catch (error) {
    status(error.message);
  }
}

function openStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pixel-vault', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const storage = openStorage().catch(() => null);

async function saveLocal(update) {
  const db = await storage;
  if (!db) throw new Error('เบราว์เซอร์ไม่อนุญาตให้บันทึก ลองเปิดเว็บผ่าน localhost');
  const saved = await new Promise((resolve, reject) => {
    const transaction = db.transaction('library', 'readwrite');
    const store = transaction.objectStore('library');
    const request = store.get('assets');
    let next;
    request.onsuccess = () => {
      next = update(request.result || []);
      store.put(next, 'assets');
    };
    transaction.oncomplete = () => resolve(next);
    transaction.onabort = () => reject(transaction.error || new Error('บันทึกไม่สำเร็จ'));
  });
  // Another tab can add an image between the initial load and this transaction.
  await Promise.all(saved.filter(asset => !images.has(asset.image)).map(checkAsset));
  local = saved;
}

function validInteger(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

async function checkAsset(raw) {
  if (!raw || typeof raw.id !== 'string' || !/^custom-[a-z0-9-]{1,80}$/.test(raw.id) ||
      typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 80 ||
      typeof raw.category !== 'string' || !raw.category.trim() || raw.category.length > 30 ||
      !validInteger(raw.width, 1, 512) || !validInteger(raw.height, 1, 512) ||
      !validInteger(raw.frames, 1, 120) || !validInteger(raw.fps, 1, 60) ||
      typeof raw.image !== 'string' || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(raw.image) ||
      raw.image.length > 14_000_000) {
    throw new Error('ข้อมูล sprite sheet ไม่ถูกต้อง หรือ PNG มีขนาดเกิน 10 MB');
  }
  const { id, name, category, width, height, frames, fps, image } = raw;
  const decoded = images.get(image) || new Image();
  if (!images.has(image)) {
    decoded.src = image;
    await decoded.decode();
  }
  if (!decoded.width || !decoded.height || decoded.width > 8192 || decoded.height > 8192 ||
      decoded.width % width || decoded.height % height || (decoded.width / width) * (decoded.height / height) < frames) {
    throw new Error('ขนาด PNG หรือจำนวนเฟรมไม่ตรงกับกริด');
  }
  images.set(image, decoded);
  return { id, name: name.trim(), category: category.trim(), width, height, frames, fps, image, loop: raw.loop !== false };
}

async function readLibrary(data) {
  if (data?.version !== 1 || !Array.isArray(data.assets)) throw new Error('ไฟล์ library.json ไม่ถูกต้อง');
  const result = [];
  for (const asset of data.assets) result.push(await checkAsset(asset));
  return result;
}

async function loadInitial() {
  const db = await storage;
  const disk = db ? new Promise((resolve, reject) => {
    const request = db.transaction('library').objectStore('library').get('assets');
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }) : Promise.resolve([]);
  const online = location.protocol === 'file:' ? Promise.resolve([]) :
    fetch('./library.json').then(async response => {
      if (!response.ok) throw new Error('เปิด library.json ไม่สำเร็จ');
      return readLibrary(await response.json());
    });
  const [fromDisk, fromSite] = await Promise.allSettled([
    disk.then(items => readLibrary({ version: 1, assets: items })), online
  ]);
  if (fromDisk.status === 'fulfilled') local = fromDisk.value;
  if (fromSite.status === 'fulfilled') published = fromSite.value;
  if (fromDisk.status === 'rejected' || fromSite.status === 'rejected') status('โหลดคลังบางส่วนไม่สำเร็จ');
  get('add').disabled = get('load-library').disabled = get('save-library').disabled = false;
  gallery();
}

get('search').oninput = gallery;
get('play').onclick = () => {
  if (!playing && frame === selected.frames - 1) frame = 0;
  setPlaying(!playing);
  draw();
};
get('restart').onclick = () => { frame = 0; setPlaying(true); draw(); };
get('frame').oninput = event => { frame = event.target.valueAsNumber; setPlaying(false); draw(); };
get('backdrop').onchange = event => { get('stage').dataset.backdrop = event.target.value; };
get('mirror').onchange = get('palette').onchange = draw;
get('seed').onclick = () => { seed = Math.floor(Math.random() * 4294967296); draw(); };
get('sheet').onclick = () => {
  buildSheet(get('sheet-preview'), selected, options());
  get('sheet-dialog').showModal();
};
get('close-sheet').onclick = () => get('sheet-dialog').close();
get('export').onclick = exportUnity;
get('add').onclick = () => { get('upload-error').textContent = ''; get('upload').showModal(); };
get('close-upload').onclick = () => get('upload').close();
get('upload-form').onsubmit = async event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const file = data.get('image');
  const submit = event.submitter;
  submit.disabled = true;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('PNG ต้องมีขนาดไม่เกิน 10 MB');
    const image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.replace(/^data:[^,]+,/, 'data:image/png;base64,'));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const asset = await checkAsset({
      id: `custom-${crypto.randomUUID()}`,
      image,
      name: data.get('name'),
      category: data.get('category'),
      width: Number(data.get('width')),
      height: Number(data.get('height')),
      frames: Number(data.get('frames')),
      fps: Number(data.get('fps'))
    });
    await saveLocal(items => [...items, asset]);
    filter = '';
    get('search').value = '';
    select(asset);
    gallery();
    get('upload').close();
    event.target.reset();
    status('บันทึกในเบราว์เซอร์นี้แล้ว');
  } catch (error) {
    get('upload-error').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};
get('remove').onclick = async () => {
  const id = selected.id;
  if (!confirm(`ลบ ${selected.name} จากคลังในเบราว์เซอร์นี้?`)) return;
  try {
    await saveLocal(items => items.filter(asset => asset.id !== id));
    select(assets().find(asset => asset.id === id) || effects[0]);
    gallery();
    status('ลบจากคลังในเบราว์เซอร์นี้แล้ว');
  } catch (error) {
    status(error.message);
  }
};
get('load-library').onclick = () => get('library-file').click();
get('library-file').onchange = async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const imported = await readLibrary(JSON.parse(await file.text()));
    await saveLocal(items => [...new Map([...items, ...imported].map(asset => [asset.id, asset])).values()]);
    select(assets().find(asset => asset.id === selected.id) || effects[0]);
    gallery();
    status(`นำเข้า ${imported.length} รายการแล้ว`);
  } catch (error) {
    status(error.message);
  }
};
get('save-library').onclick = () => {
  const custom = assets().filter(asset => !asset.style);
  download('library.json', new Blob([JSON.stringify({ version: 1, assets: custom })], { type: 'application/json' }));
  status('บันทึก library.json สำหรับสำรองหรืออัปเดตเว็บแล้ว');
};

get('add').disabled = get('load-library').disabled = get('save-library').disabled = true;
select(effects.find(asset => asset.id === location.hash.slice(1)) || effects[0]);
gallery();
requestAnimationFrame(tick);
loadInitial();
