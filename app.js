'use strict';

const get = id => document.getElementById(id);
const libraryMode = document.documentElement.dataset;
const isLocalAddress = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const managementMode = libraryMode.libraryMode !== 'public' && isLocalAddress &&
  new URLSearchParams(location.search).get('manage') === '1';
libraryMode.libraryMode = managementMode ? 'local' : 'public';
const publicLibrary = !managementMode;
const preview = get('preview');
const thumbnailContext = { palette: 'original', mirror: false, seed: 173 };
const images = new Map();
let local = [];
let published = [];
let removedIds = new Set();
let publishedHiddenSamples = [];
const samples = [...effects, characterWalk];
const sampleIds = new Set(samples.map(asset => asset.id));
let selected = effects[0];
let filter = '';
let frame = 0;
let playing = true;
let lastFrame = performance.now();
let seed = thumbnailContext.seed;
let characterSettings;
let characterDirection = 0;
let libraryReady = false;
let savingCharacter = false;

const isCharacter = asset => asset.kind === characterWalk.kind;
const previewFrameCount = () => isCharacter(selected) ? walkPoses.length : selected.frames;

function status(message) {
  get('status').textContent = message;
}

function assets() {
  const custom = new Map([...published, ...local].map(asset => [asset.id, asset]));
  return [...samples.filter(asset => !publishedHiddenSamples.includes(asset.id) || removedIds.has('restore:' + asset.id)), ...custom.values()]
    .filter(asset => !removedIds.has(asset.id));
}

function renderFrame(canvas, asset, index, options) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (options.mirror) {
    ctx.translate(asset.width, 0);
    ctx.scale(-1, 1);
  }
  if (isCharacter(asset)) {
    drawCharacter(ctx, index + (asset.start || 0), options.characterSettings || asset.generatorSettings);
  } else if (asset.style) {
    drawEffect(ctx, asset, index, palettes[options.palette] || asset.colors, options.seed);
  } else {
    const image = images.get(asset.image);
    const columns = image.width / asset.width;
    index += asset.start || 0;
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
    (!filter || filter === asset.category) && `${asset.name} ${asset.category} ${asset.group || ''}`.toLowerCase().includes(query));
  get('count').textContent = `${visible.length} / ${all.length}`;
  if (!visible.length) {
    const message = document.createElement('p');
    message.textContent = 'ไม่พบ Asset';
    get('gallery').replaceChildren(message);
    return;
  }
  get('gallery').replaceChildren(...visible.map(asset => {
    const card = document.createElement('button');
    card.className = 'card';
    card.title = asset.group ? `${asset.group} · ${asset.name}` : asset.name;
    card.setAttribute('aria-pressed', String(asset.id === selected?.id));
    const thumb = document.createElement('canvas');
    thumb.width = asset.width;
    thumb.height = asset.height;
    thumb.setAttribute('aria-hidden', 'true');
    renderFrame(thumb, asset, isCharacter(asset) ? 0 : Math.floor(asset.frames * .45), thumbnailContext);
    const name = document.createElement('span');
    name.textContent = asset.name;
    card.append(thumb, name);
    if (asset.group) {
      const group = document.createElement('small');
      group.textContent = asset.group;
      card.append(group);
    }
    card.onclick = () => {
      select(asset);
      get('gallery').querySelectorAll('.card').forEach(button => button.setAttribute('aria-pressed', String(button === card)));
    };
    return card;
  }));
}

function options() {
  if (isCharacter(selected)) return { characterSettings };
  return { mirror: get('mirror').checked, palette: get('palette').value, seed };
}

function draw() {
  const rowOffset = isCharacter(selected) ? characterDirection * walkPoses.length : 0;
  renderFrame(preview, selected, rowOffset + frame, options());
  get('frame').value = frame;
  get('frame-number').textContent = `${frame + 1} / ${previewFrameCount()}`;
}

function setPlaying(value) {
  playing = value;
  get('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
  lastFrame = performance.now();
}

function select(asset) {
  selected = asset;
  get('studio').hidden = !asset;
  if (!asset) {
    setPlaying(false);
    return;
  }
  const character = isCharacter(asset);
  get('character-controls').hidden = get('save-character').hidden = !character;
  get('save-character').disabled = !libraryReady || savingCharacter;
  get('export').hidden = character;
  get('export-group').hidden = !character && !asset.group;
  get('download-original').hidden = !asset.pngFile;
  get('edit').hidden = !asset.id.startsWith('custom-');
  get('sheet').textContent = character ? 'Details & Export' : 'Sprite sheet';
  for (const id of ['palette', 'fps', 'ppu', 'mirror', 'loop']) get(id).closest('label').hidden = character;
  get('seed').hidden = character;
  if (character) {
    characterSettings = asset.generatorSettings;
    get('shirt-color').value = characterSettings.shirtColor;
    get('hair-color').value = characterSettings.hairColor;
    get('character-seed').value = characterSettings.seed;
    get('direction').value = characterDirection = 0;
  }
  get('title').textContent = asset.name;
  get('category').textContent = asset.category;
  get('spec').textContent = `${asset.width} × ${asset.height} px · ${asset.frames} frames`;
  preview.width = asset.width;
  preview.height = asset.height;
  get('frame').max = previewFrameCount() - 1;
  get('fps').value = asset.fps;
  get('ppu').value = asset.ppu ?? 64;
  get('loop').checked = asset.loop;
  get('mirror').checked = false;
  get('palette').value = 'original';
  get('palette').disabled = get('seed').disabled = !asset.style;
  get('remove').disabled = !libraryReady;
  seed = thumbnailContext.seed;
  frame = 0;
  setPlaying(true);
  draw();
}

function tick(now) {
  requestAnimationFrame(tick);
  if (!selected) return;
  const character = isCharacter(selected);
  const interval = 1000 / (character ? selected.fps : get('fps').valueAsNumber || selected.fps);
  const count = previewFrameCount();
  const steps = Math.floor((now - lastFrame) / interval);
  if (playing && steps > 0) {
    const next = frame + steps;
    if (character || get('loop').checked) {
      frame = next % count;
    } else {
      frame = Math.min(count - 1, next);
      if (next >= count) setPlaying(false);
    }
    lastFrame = now - ((now - lastFrame) % interval);
    draw();
  }
}

function buildSheet(canvas, asset, settings) {
  const columns = isCharacter(asset) ? asset.columns : Math.min(8, asset.frames);
  canvas.width = columns * asset.width;
  canvas.height = Math.ceil(asset.frames / columns) * asset.height;
  const cell = document.createElement('canvas');
  cell.width = asset.width;
  cell.height = asset.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
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
  const asset = { ...selected, fps: get('fps').valueAsNumber, loop: get('loop').checked };
  await exportClips([asset], options(), get('ppu').valueAsNumber);
}

function fileStem(asset) {
  const name = asset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || asset.id;
  return asset.style ? name : `${name}-${asset.id.slice(-8)}`;
}

async function unityFiles(asset, settings, ppu) {
  const stem = fileStem(asset);
  const canvas = document.createElement('canvas');
  const columns = buildSheet(canvas, asset, settings);
  const metadata = {
    version: 1,
    image: `${stem}.png`,
    width: asset.width,
    height: asset.height,
    frames: asset.frames,
    columns,
    fps: asset.fps,
    ppu,
    loop: asset.loop,
    pivotFeet: asset.pivot === 'feet'
  };
  const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('สร้าง PNG ไม่สำเร็จ');
  return [
    [metadata.image, new Uint8Array(await png.arrayBuffer())],
    [`${stem}.pixelvault.json`, encoder.encode(JSON.stringify(metadata, null, 2))]
  ];
}

async function exportClips(clips, settings, ppu, group) {
  try {
    const files = [];
    for (const asset of clips) files.push(...await unityFiles(asset, settings, ppu));
    download(`${group ? fileStem({ name: group, id: 'character', style: true }) : fileStem(clips[0])}-unity.zip`, zip(files));
    status(`ส่งออก ${clips.length} คลิปสำหรับ Unity แล้ว`);
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

const storage = publicLibrary ? Promise.resolve(null) : openStorage().catch(() => null);

async function saveLocal(update, updateRemoved) {
  const db = await storage;
  if (!db) throw new Error('เบราว์เซอร์ไม่อนุญาตให้บันทึก ลองเปิดเว็บผ่าน localhost');
  const saved = await new Promise((resolve, reject) => {
    const transaction = db.transaction('library', 'readwrite');
    const store = transaction.objectStore('library');
    const assetRequest = store.get('assets');
    const removedRequest = store.get('removedIds');
    let next, nextRemoved;
    removedRequest.onsuccess = () => {
      next = update(assetRequest.result || []);
      nextRemoved = new Set(removedRequest.result || []);
      if (updateRemoved) {
        updateRemoved(nextRemoved);
        store.put([...nextRemoved], 'removedIds');
      }
      store.put(next, 'assets');
    };
    transaction.oncomplete = () => resolve({ items: next, removed: nextRemoved });
    transaction.onabort = () => reject(transaction.error || new Error('บันทึกไม่สำเร็จ'));
  });
  // Another tab can add an image between the initial load and this transaction.
  await Promise.all(saved.items.filter(asset => !isCharacter(asset) && !images.has(asset.image)).map(asset => checkAsset(asset)));
  local = saved.items;
  removedIds = saved.removed;
}

function validInteger(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

async function checkAsset(raw, allowPublishedPng = false) {
  if (!raw || typeof raw.id !== 'string' || !/^custom-[a-z0-9-]{1,80}$/.test(raw.id) ||
      typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 80) {
    throw new Error('ชื่อหรือรหัส Asset ไม่ถูกต้อง');
  }
  if (isCharacter(raw)) {
    const { shirtColor, hairColor, seed } = raw.generatorSettings || {};
    if (![shirtColor, hairColor].every(color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) ||
        !validInteger(seed, 0, 4294967295)) {
      throw new Error('สีหรือ seed ของตัวละครไม่ถูกต้อง');
    }
    const category = typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim().slice(0, 30) : characterWalk.category;
    return { ...characterWalk, id: raw.id, name: raw.name.trim(), category, generatorSettings: { shirtColor, hairColor, seed } };
  }
  const pngFile = allowPublishedPng && typeof raw.pngFile === 'string' &&
    /^[^/\\\u0000-\u001f]+\.png$/i.test(raw.pngFile) ? raw.pngFile : undefined;
  const image = pngFile ? './assets/' + encodeURIComponent(pngFile) : raw.image;
  const validInlineImage = typeof image === 'string' &&
    /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(image) && image.length <= 14_000_000;
  if (typeof raw.category !== 'string' || !raw.category.trim() || raw.category.length > 30 ||
      !validInteger(raw.width, 1, 512) || !validInteger(raw.height, 1, 512) ||
      !validInteger(raw.frames, 1, 120) || !validInteger(raw.fps, 1, 60) ||
      (!pngFile && !validInlineImage)) {
    throw new Error('ข้อมูล sprite sheet ไม่ถูกต้อง หรือ PNG มีขนาดเกิน 10 MB');
  }
  const { id, name, category, width, height, frames, fps } = raw;
  const start = raw.start ?? 0;
  const group = typeof raw.group === 'string' ? raw.group.trim().slice(0, 80) : '';
  const decoded = images.get(image) || new Image();
  if (!images.has(image)) {
    decoded.src = image;
    await decoded.decode();
  }
  if (!decoded.width || !decoded.height || decoded.width > 8192 || decoded.height > 8192 ||
      decoded.width % width || decoded.height % height ||
      !validInteger(start, 0, (decoded.width / width) * (decoded.height / height) - frames)) {
    throw new Error('ขนาด PNG หรือจำนวนเฟรมไม่ตรงกับกริด');
  }
  images.set(image, decoded);
  return { id, name: name.trim(), category: category.trim(), width, height, frames, fps, image,
    pngFile, ppu: validInteger(raw.ppu, 1, 1024) ? raw.ppu : 64,
    loop: raw.loop !== false, start, group, pivot: raw.pivot === 'feet' ? 'feet' : 'center' };
}

async function readLibrary(data) {
  if (data?.version !== 1 || !Array.isArray(data.assets)) throw new Error('ไฟล์ library.json ไม่ถูกต้อง');
  const result = [];
  for (const asset of data.assets) result.push(await checkAsset(asset));
  return result;
}

function hiddenSamples(data) {
  return Array.isArray(data.hiddenSamples) ? data.hiddenSamples.filter(id => sampleIds.has(id)) : [];
}

async function loadInitial() {
  const db = await storage;
  const disk = db ? new Promise((resolve, reject) => {
    const transaction = db.transaction('library');
    const store = transaction.objectStore('library');
    const items = store.get('assets');
    const removed = store.get('removedIds');
    transaction.oncomplete = () => resolve({ items: items.result || [], removed: removed.result || [] });
    transaction.onabort = () => reject(transaction.error);
  }) : Promise.resolve({ items: [], removed: [] });
  const online = location.protocol === 'file:' ? Promise.resolve({ items: [], hidden: [], skipped: 0 }) :
    fetch('./library.json').then(async response => {
      if (!response.ok) throw new Error('เปิด library.json ไม่สำเร็จ');
      const data = await response.json();
      if (!publicLibrary) return { items: await readLibrary(data), hidden: hiddenSamples(data), skipped: 0 };
      if (data?.version !== 1 || !Array.isArray(data.assets)) throw new Error('ไฟล์ library.json ไม่ถูกต้อง');
      const items = [];
      let skipped = 0;
      for (const raw of data.assets) {
        try {
          items.push(await checkAsset(raw, true));
        } catch {
          skipped++;
        }
      }
      return { items, hidden: hiddenSamples(data), skipped };
    });
  const [fromDisk, fromSite] = await Promise.allSettled([
    disk.then(async ({ items, removed }) => {
      removedIds = new Set(removed);
      return readLibrary({ version: 1, assets: items });
    }), online
  ]);
  if (fromDisk.status === 'fulfilled') local = fromDisk.value;
  if (fromSite.status === 'fulfilled') {
    published = fromSite.value.items;
    publishedHiddenSamples = fromSite.value.hidden;
  }
  if (fromDisk.status === 'rejected' || fromSite.status === 'rejected') status('โหลดคลังบางส่วนไม่สำเร็จ');
  else if (fromSite.value.skipped) status(`โหลด Asset ไม่สำเร็จ ${fromSite.value.skipped} รายการ`);
  get('add').disabled = get('load-library').disabled = get('save-library').disabled = false;
  libraryReady = true;
  get('restore-samples').disabled = false;
  const available = assets();
  const preferred = available.find(asset => asset.id === location.hash.slice(1));
  select(preferred || available.find(asset => asset.id === selected?.id) || available[0]);
  get('save-character').disabled = false;
  gallery();
}

get('search').oninput = gallery;
get('play').onclick = () => {
  if (!playing && frame === previewFrameCount() - 1) frame = 0;
  setPlaying(!playing);
  draw();
};
get('restart').onclick = () => { frame = 0; setPlaying(true); draw(); };
get('frame').oninput = event => { frame = event.target.valueAsNumber; setPlaying(false); draw(); };
get('backdrop').onchange = event => { get('stage').dataset.backdrop = event.target.value; };
get('mirror').onchange = get('palette').onchange = draw;
get('seed').onclick = () => { seed = Math.floor(Math.random() * 4294967296); draw(); };
function updateCharacterSettings() {
  const seedInput = get('character-seed');
  characterSettings = {
    shirtColor: get('shirt-color').value,
    hairColor: get('hair-color').value,
    seed: seedInput.validity.valid ? seedInput.valueAsNumber : characterSettings.seed
  };
  draw();
}

for (const id of ['shirt-color', 'hair-color', 'character-seed']) get(id).oninput = updateCharacterSettings;
get('random-character-seed').onclick = () => {
  get('character-seed').value = crypto.getRandomValues(new Uint32Array(1))[0];
  updateCharacterSettings();
};
get('direction').onchange = event => {
  characterDirection = Number(event.target.value);
  frame = 0;
  lastFrame = performance.now();
  draw();
};
get('save-character').onclick = async event => {
  if (!get('character-seed').reportValidity()) return;
  const button = event.currentTarget;
  const source = selected;
  const settings = characterSettings;
  button.disabled = savingCharacter = true;
  try {
    const asset = await checkAsset({
      ...characterWalk,
      id: `custom-${crypto.randomUUID()}`,
      name: `Character Walk · ${settings.seed}`,
      generatorSettings: settings
    });
    await saveLocal(items => [...items, asset]);
    if (selected === source && characterSettings === settings) {
      filter = '';
      get('search').value = '';
      select(asset);
    }
    gallery();
    status('บันทึกตัวละครใน Library แล้ว');
  } catch (error) {
    status(error.message);
  } finally {
    button.disabled = savingCharacter = false;
  }
};

let sheetMetadata;
get('sheet').onclick = () => {
  const character = isCharacter(selected);
  if (character && !get('character-seed').reportValidity()) return;
  const dialog = get('sheet-dialog');
  dialog.toggleAttribute('data-character', character);
  get('sheet-title').textContent = character ? selected.name : 'Sprite sheet';
  get('sheet-details').hidden = get('character-exports').hidden = !character;
  get('character-export-error').textContent = '';
  sheetMetadata = character ? characterMetadata(selected, characterSettings) : null;
  buildSheet(get('sheet-preview'), selected, options());
  dialog.showModal();
};
get('export-png').onclick = () => {
  const filename = `character-walk-${sheetMetadata.seed}.png`;
  get('sheet-preview').toBlob(blob => {
    if (blob) download(filename, blob);
    else get('character-export-error').textContent = 'สร้าง PNG ไม่สำเร็จ';
  }, 'image/png');
};
get('export-json').onclick = () => {
  download(`character-walk-${sheetMetadata.seed}.json`,
    new Blob([JSON.stringify(sheetMetadata, null, 2)], { type: 'application/json' }));
};
get('close-sheet').onclick = () => get('sheet-dialog').close();
get('download-original').onclick = () => {
  if (!selected?.pngFile) return;
  const link = document.createElement('a');
  link.href = selected.image;
  link.download = selected.pngFile;
  link.click();
};
get('export').onclick = exportUnity;
get('export-group').onclick = () => {
  const asset = selected;
  if (isCharacter(asset)) {
    if (!get('character-seed').reportValidity()) return;
    const clips = walkDirections.map((direction, row) => ({
      ...asset, id: `${asset.id}-${direction}`, name: `${asset.name} Walk ${direction}`,
      start: row * walkPoses.length, frames: walkPoses.length, pivot: 'feet'
    }));
    return exportClips(clips, options(), 32, asset.name);
  }
  if (!get('ppu').reportValidity()) return;
  const clips = assets().filter(clip => clip.group === asset.group);
  return exportClips(clips, thumbnailContext, get('ppu').valueAsNumber, asset.group);
};

const uploadForm = get('upload-form');
const fields = uploadForm.elements;
let editing;
let draftImage;
let imageRead = 0;
let rowLayout = '';
let previewStarted = 0;
let previewClip;

function openUpload(asset) {
  imageRead++;
  editing = asset;
  draftImage = asset?.image;
  rowLayout = '';
  uploadForm.reset();
  const generated = !!asset && isCharacter(asset);
  fields.image.required = !asset;
  get('image-field').hidden = get('grid-fields').hidden = get('group-field').hidden = get('grid-help').hidden = generated;
  get('split-field').hidden = !!asset;
  get('start-field').hidden = !asset;
  get('upload-title').textContent = asset ? 'แก้ไข Asset' : 'Add sprite sheet';
  if (asset) {
    for (const key of ['name', 'category', 'width', 'height', 'frames', 'fps', 'group', 'pivot']) {
      if (asset[key] !== undefined) fields[key].value = asset[key];
    }
    fields.start.value = (asset.start || 0) + 1;
    fields.loop.checked = asset.loop;
  }
  const groups = new Set(assets().map(item => item.group).filter(Boolean));
  get('character-groups').replaceChildren(...[...groups].map(group => new Option(group)));
  get('upload-error').textContent = '';
  updateImportPreview();
  get('upload').showModal();
}

get('add').onclick = () => openUpload();
get('edit').onclick = () => openUpload(selected);
get('close-upload').onclick = () => get('upload').close();

function clipRows() {
  return [...get('row-settings').children];
}

function draftClips(columns) {
  if (!fields.split.checked) return [{
    name: fields.name.value.trim(), start: fields.start.valueAsNumber - 1, frames: fields.frames.valueAsNumber,
    fps: fields.fps.valueAsNumber, pivot: fields.pivot.value, loop: fields.loop.checked
  }];
  return clipRows().map((row, index) => {
    const [name, frames, fps, pivot] = row.querySelectorAll('input, select');
    return { name: name.value.trim(), start: columns * index, frames: frames.valueAsNumber,
      fps: fps.valueAsNumber, pivot: pivot.value, loop: fields.loop.checked };
  });
}

function updateImportPreview() {
  const image = images.get(draftImage);
  const width = fields.width.valueAsNumber;
  const height = fields.height.valueAsNumber;
  const columns = image?.width / width;
  const rows = image?.height / height;
  const gridValid = !!image && validInteger(columns, 1, 8192) && validInteger(rows, 1, 8192);
  const split = fields.split.checked && !editing;
  const rowSettings = get('row-settings');
  fields.frames.disabled = split;
  for (const key of ['frames', 'fps', 'pivot']) fields[key].closest('label').hidden = split;
  get('import-preview').hidden = !image;
  rowSettings.hidden = !split || !gridValid || rows > 120;
  if (split && gridValid && rows <= 120) {
    const layout = `${rows}:${columns}`;
    if (rowLayout !== layout) {
      rowLayout = layout;
      const directions = ['Walk Down', 'Walk Left', 'Walk Right', 'Walk Up'];
      rowSettings.replaceChildren(...Array.from({ length: rows }, (_, index) => {
        const row = document.createElement('div');
        row.className = 'clip-row';
        row.innerHTML = '<label>ชื่อคลิป <input maxlength="80"></label><label>เฟรม <input type="number" min="1"></label><label>FPS <input type="number" min="1" max="60"></label><label>Pivot <select><option value="center">กึ่งกลาง</option><option value="feet">ด้านล่าง</option></select></label>';
        const [name, frames, fps, pivot] = row.querySelectorAll('input, select');
        name.value = rows === 4 ? directions[index] : `Row ${index + 1}`;
        frames.max = frames.value = Math.min(120, columns);
        fps.value = fields.fps.value;
        pivot.value = 'feet';
        return row;
      }));
    }
  } else {
    rowLayout = '';
    rowSettings.replaceChildren();
  }
  const clips = gridValid ? draftClips(columns) : [];
  const picker = get('preview-clip');
  const current = picker.value;
  picker.replaceChildren(...clips.map((clip, index) => new Option(clip.name || `Row ${index + 1}`, index)));
  if (clips[current]) picker.value = current;
  previewClip = clips[picker.value];
  picker.disabled = clips.length === 0;
  if (!image) return;
  get('grid-summary').textContent = gridValid
    ? `${image.width} × ${image.height} px · ${columns} คอลัมน์ × ${rows} แถว`
    : 'ขนาด PNG หารด้วยขนาดเฟรมไม่ลงตัว';
  const canvas = get('import-grid');
  const scale = Math.min(1, 720 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (gridValid) {
    const clip = previewClip;
    const cellWidth = canvas.width / columns;
    const cellHeight = canvas.height / rows;
    ctx.strokeStyle = '#e1fa7a';
    ctx.globalAlpha = .65;
    ctx.beginPath();
    if (cellWidth >= 2) for (let i = 1; i < columns; i++) { ctx.moveTo(i * cellWidth, 0); ctx.lineTo(i * cellWidth, canvas.height); }
    if (cellHeight >= 2) for (let i = 1; i < rows; i++) { ctx.moveTo(0, i * cellHeight); ctx.lineTo(canvas.width, i * cellHeight); }
    ctx.stroke();
    ctx.globalAlpha = .25;
    ctx.fillStyle = '#e1fa7a';
    if (clip && validInteger(clip.frames, 1, 120) && validInteger(clip.start, 0, rows * columns - clip.frames)) {
      for (let i = clip.start; i < clip.start + clip.frames; i++) {
        ctx.fillRect((i % columns) * cellWidth, Math.floor(i / columns) * cellHeight, cellWidth, cellHeight);
      }
    }
  }
  previewStarted = performance.now();
  drawImportAnimation();
}

function drawImportAnimation() {
  const image = images.get(draftImage);
  const canvas = get('import-animation');
  const width = fields.width.valueAsNumber;
  const height = fields.height.valueAsNumber;
  if (!image || !validInteger(width, 1, 512) || !validInteger(height, 1, 512)) return;
  const columns = image.width / width;
  const capacity = columns * (image.height / height);
  const clip = previewClip;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  if (!clip || !validInteger(columns, 1, 8192) || image.height % height ||
      !validInteger(clip.frames, 1, 120) || !validInteger(clip.start, 0, capacity - clip.frames) ||
      !validInteger(clip.fps, 1, 60)) return;
  const elapsed = Math.floor((performance.now() - previewStarted) * clip.fps / 1000);
  const index = clip.start + (clip.loop ? elapsed % clip.frames : Math.min(elapsed, clip.frames - 1));
  ctx.drawImage(image, (index % columns) * width, Math.floor(index / columns) * height,
    width, height, 0, 0, width, height);
}

setInterval(() => {
  if (get('upload').open && !get('import-preview').hidden) drawImportAnimation();
}, 33);
uploadForm.addEventListener('input', event => {
  if (event.target !== fields.image) updateImportPreview();
});
get('preview-clip').onchange = updateImportPreview;
fields.image.onchange = async () => {
  const read = ++imageRead;
  const file = fields.image.files[0];
  draftImage = file ? undefined : editing?.image;
  updateImportPreview();
  get('upload-error').textContent = '';
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('PNG ต้องมีขนาดไม่เกิน 10 MB');
    const image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.replace(/^data:[^,]+,/, 'data:image/png;base64,'));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    if (!/^data:image\/png;base64,iVBORw0KGgo/.test(image)) throw new Error('กรุณาเลือกไฟล์ PNG');
    const decoded = new Image();
    decoded.src = image;
    await decoded.decode();
    if (decoded.width > 8192 || decoded.height > 8192) throw new Error('PNG ต้องมีขนาดไม่เกิน 8192 × 8192 px');
    if (read !== imageRead) return;
    images.set(image, decoded);
    draftImage = image;
    updateImportPreview();
  } catch (error) {
    if (read === imageRead) get('upload-error').textContent = error.message;
  }
};

uploadForm.onsubmit = async event => {
  event.preventDefault();
  const submit = event.submitter;
  get('close-upload').disabled = submit.disabled = true;
  try {
    const name = fields.name.value.trim();
    const category = fields.category.value.trim();
    if (!name || !category) throw new Error('กรอกชื่อและหมวดหมู่');
    let additions;
    if (editing && isCharacter(editing)) {
      additions = [await checkAsset({ ...editing, name, category })];
    } else {
      const image = images.get(draftImage);
      if (!image) throw new Error('กรุณาเลือก PNG และรอให้พรีวิวแสดง');
      const width = fields.width.valueAsNumber;
      const height = fields.height.valueAsNumber;
      const columns = image.width / width;
      const rows = image.height / height;
      if (!Number.isInteger(columns) || !Number.isInteger(rows)) throw new Error('ขนาด PNG หารด้วยขนาดเฟรมไม่ลงตัว');
      if (fields.split.checked && rows > 120) throw new Error('แบ่งคลิปได้สูงสุด 120 แถวต่อ PNG');
      const clips = draftClips(columns).filter(clip => clip.name);
      if (!clips.length) throw new Error('ตั้งชื่ออย่างน้อยหนึ่งคลิป');
      const group = fields.group.value.trim() || (fields.split.checked ? name : '');
      additions = await Promise.all(clips.map(clip => checkAsset({
        ...clip, id: editing?.id || `custom-${crypto.randomUUID()}`, image: draftImage, category, group, width, height,
        ppu: editing?.ppu
      })));
    }
    await saveLocal(items => [...items.filter(item => !additions.some(asset => asset.id === item.id)), ...additions]);
    filter = '';
    get('search').value = '';
    select(additions[0]);
    gallery();
    get('upload').close();
    status(`บันทึก ${additions.length} คลิปในเบราว์เซอร์นี้แล้ว`);
  } catch (error) {
    get('upload-error').textContent = error.message;
  } finally {
    get('close-upload').disabled = submit.disabled = false;
  }
};
get('upload').addEventListener('cancel', event => {
  if (get('close-upload').disabled) event.preventDefault();
});
let lastRemoved;
let removing = false;
get('remove').onclick = async () => {
  if (!libraryReady || !selected || removing) return;
  const { id, name } = selected;
  if (!confirm(`ลบ ${name} จากคลังในเบราว์เซอร์นี้?`)) return;
  const isPublished = sampleIds.has(id) || published.some(asset => asset.id === id);
  const previousLocal = local.find(asset => asset.id === id);
  removing = get('remove').disabled = true;
  try {
    await saveLocal(items => items.filter(asset => asset.id !== id), removed => removed.add(id));
    lastRemoved = { id, previousLocal };
    get('undo-remove').hidden = false;
    if (selected?.id === id) {
      const remaining = assets();
      select(remaining.find(asset => asset.category === filter) || remaining[0]);
    }
    gallery();
    status(isPublished
      ? 'ลบจากคลังในเบราว์เซอร์นี้แล้ว กด Export library แล้วอัปเดต library.json บน GitHub เพื่อลบจากเว็บที่เผยแพร่'
      : 'ลบจากคลังในเบราว์เซอร์นี้แล้ว');
  } catch (error) {
    status(error.message);
  } finally {
    removing = get('remove').disabled = false;
  }
};
get('undo-remove').onclick = async () => {
  if (!lastRemoved) return;
  const { id, previousLocal } = lastRemoved;
  const button = get('undo-remove');
  button.disabled = true;
  try {
    await saveLocal(items => previousLocal && !items.some(asset => asset.id === id) ? [...items, previousLocal] : items,
      removed => removed.delete(id));
    select(assets().find(asset => asset.id === id) || assets()[0]);
    gallery();
    if (lastRemoved?.id === id) {
      lastRemoved = undefined;
      button.hidden = true;
    }
    status('คืนรายการที่ลบล่าสุดแล้ว');
  } catch (error) {
    status(error.message);
  } finally {
    button.disabled = false;
  }
};
get('restore-samples').onclick = async () => {
  const button = get('restore-samples');
  button.disabled = true;
  try {
    await saveLocal(items => items, removed => {
      for (const id of sampleIds) {
        removed.delete(id);
        if (publishedHiddenSamples.includes(id)) removed.add('restore:' + id);
      }
    });
    filter = '';
    get('search').value = '';
    if (!selected) select(assets()[0]);
    gallery();
    status('คืนค่าตัวอย่างทั้งหมดแล้ว');
  } catch (error) {
    status(error.message);
  } finally {
    button.disabled = false;
  }
};
get('load-library').onclick = () => get('library-file').click();
get('library-file').onchange = async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const imported = await readLibrary(data);
    await saveLocal(
      items => [...new Map([...items, ...imported].map(asset => [asset.id, asset])).values()],
      removed => {
        imported.forEach(asset => removed.delete(asset.id));
        hiddenSamples(data).forEach(id => removed.add(id));
      }
    );
    const available = assets();
    select(available.find(asset => asset.id === selected?.id) || available[0]);
    gallery();
    status(`นำเข้า ${imported.length} รายการแล้ว`);
  } catch (error) {
    status(error.message);
  }
};
get('save-library').onclick = () => {
  const custom = assets().filter(asset => asset.id.startsWith('custom-'));
  const hidden = [...sampleIds].filter(id => removedIds.has(id) ||
    (publishedHiddenSamples.includes(id) && !removedIds.has('restore:' + id)));
  download('library.json', new Blob([JSON.stringify({ version: 1, assets: custom, hiddenSamples: hidden })], { type: 'application/json' }));
  status('บันทึก library.json สำหรับสำรองหรืออัปเดตเว็บแล้ว');
};

get('add').disabled = get('load-library').disabled = get('save-library').disabled = true;
select(assets().find(asset => asset.id === location.hash.slice(1)) || effects[0]);
gallery();
requestAnimationFrame(tick);
loadInitial();
