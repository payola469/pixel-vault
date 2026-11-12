'use strict';

const walkDirections = ['down', 'left', 'right', 'up'];
const walkPoses = ['idle', 'left-step', 'passing', 'right-step'];
const characterWalk = Object.freeze({
  id: 'character-walk',
  kind: 'character-walk',
  name: 'Character Walk',
  category: 'Characters',
  width: 32,
  height: 32,
  frames: 16,
  columns: 4,
  fps: 8,
  loop: true,
  generatorSettings: Object.freeze({ shirtColor: '#f5e2c7', hairColor: '#945b42', seed: 173 })
});

// Hand-drawn pixel rows for the fringe, glasses and ponytail.
const walkHeads = {
  down: [
    '......######',
    '....##hhhhhh##',
    '...#hllhhllhhh#',
    '..#hlLlhhllhhhh#',
    '.#hLLlhhllhhhhh#',
    '.#hllhhdhhhllhhd#',
    '#hhhhhdshhhhhhhd#',
    '#hhhhdssdhhhshhd#.#',
    '#hhddssssddssshd#th#',
    '#hdsGGGsssGGGsd#hld#',
    '#hdsGwEGGGGwEsd#hld#',
    '.#dsGweGssGweGd#hdd#',
    '.#hpsGgssssGgp#hdd#',
    '..#hpsssmsssp##hd#',
    '...##ppssss##.###',
    '.....######'
  ],
  left: [
    '.....#######',
    '...##hhhhhhh##',
    '..#hllhhllhhhh#',
    '.#hlLlhhllhhhhh#',
    '.#hllhhhllhhhhhd#',
    '#hhhhhdhhhhhhlhd#',
    '#hhhhhddhhhhhhhd#',
    '#hhhhsddhhhhhhdd#t#',
    '.#hhsGssddhhdhd#hld#',
    '.#ssGwEGGssdd#hhld#',
    '#sssGweGsppsh#hhdd#',
    '#psssGgssspdh#hdd#',
    '.#mpsssssddh##hd#',
    '..#ppsssdd##..##',
    '...#######'
  ],
  up: [
    '......######',
    '....##hhhhhh##',
    '...#hllhhhllhh#',
    '..#hlLlhhhllhhh#',
    '.#hlllhhhllhhhhh#',
    '.#hhhhhlhhhhhhhd#',
    '#hhhhhllhhhhlhhdd#',
    '#hhhhhhdhhhlhhhdd#',
    '#hhhhdhdtdhhhhddd#',
    '#hhhdd#tt#hhddddd#',
    '.#ddd#hlhh#ddddd#',
    '..#dd#hLlhd#ddd#',
    '...##hhlhhd####',
    '....#hhlhdd#',
    '.....#hhdd#',
    '......####'
  ]
};

function drawCharacter(ctx, index, { shirtColor, hairColor, seed }) {
  const direction = walkDirections[Math.floor(index / walkPoses.length)];
  const pose = index % walkPoses.length;
  const stride = [0, -1, 0, 1][pose];
  const side = direction === 'left' || direction === 'right';
  const back = direction === 'up';
  // Mix the seed once per character. All directions and poses share the result.
  let variation = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  variation = Math.imul(variation ^ (variation >>> 16), 0x45d9f3b);
  variation = (variation ^ (variation >>> 16)) >>> 0;
  const skinTones = ['#ffd4ad', '#e4aa83', '#b98061', '#f6bf98'];
  const skin = skinTones[(variation + 1) & 3];
  const outline = '#402924';
  const leather = '#906449';
  const shade = (color, amount) => {
    const rgb = Number.parseInt(color.slice(1), 16);
    const channels = [16, 8, 0].map(shift =>
      Math.max(0, Math.min(255, ((rgb >>> shift) & 255) + amount)));
    return '#' + channels.map(channel => channel.toString(16).padStart(2, '0')).join('');
  };
  const shirtShadow = shade(shirtColor, -27);
  const skirt = shade('#799060', ((variation >>> 4) & 15) - 7);
  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  ctx.save();
  // Draw left-facing silhouettes and reflect the complete pose for right.
  if (direction === 'right') {
    ctx.translate(32, 0);
    ctx.scale(-1, 1);
  }
  const bob = pose === 2 ? -1 : 0;
  const upper = (x, y, w, h, color) => rect(x, y + bob, w, h, color);
  const leg = (x, foot, lift, far) => {
    rect(x, 22, 5, 5 - lift, outline);
    rect(x + 1, 23, 3, 3 - lift, far ? shade(skin, -24) : '#fff0db');
    rect(foot, 26 - lift, side ? 6 : 5, 3, outline);
    rect(foot + 1, 26 - lift, side ? 4 : 3, 2, far ? shade(leather, -17) : leather);
    rect(foot + 1, 26 - lift, 2, 1, shade(leather, 23));
  };
  const arm = (x, y, far) => {
    upper(x + 1, y, 3, 1, outline);
    upper(x, y + 1, 5, 4, outline);
    upper(x + 1, y + 5, 3, 1, outline);
    upper(x + 1, y + 1, 3, 3, far ? shirtShadow : shirtColor);
    upper(x + 1, y + 4, 3, 1, far ? shade(skin, -22) : skin);
  };

  if (side) {
    leg(14 - stride, 13 - 3 * stride, stride < 0 ? 2 : 0, true);
    leg(15 + stride, 13 + 3 * stride, stride > 0 || pose === 2 ? 2 : 0, false);
    arm(15 + 2 * stride, 17, true);
  } else {
    const reach = back ? -stride : stride;
    leg(11, 11, reach > 0 || pose === 2 ? 2 : 0, reach > 0);
    leg(17, 17, reach < 0 ? 2 : 0, reach < 0);
    arm(8, 17 + reach, reach < 0);
    arm(19, 17 - reach, reach > 0);
  }

  upper(12, 16, 8, 1, outline);
  upper(11, 17, 10, 6, outline);
  upper(12, 17, 8, 5, shirtShadow);
  upper(12, 17, 7, 4, shirtColor);
  if (!side && !back) {
    upper(14, 17, 4, 1, '#c18a68');
    upper(17, 19, 2, 1, '#cb8857');
    upper(18, 18, 1, 3, '#cb8857');
  }
  upper(11, 22, 10, 1, outline);
  upper(10, 23, 12, 2, outline);
  upper(11, 25, 10, 1, outline);
  upper(12, 22, 8, 1, shade(skirt, -22));
  upper(11, 23, 10, 2, skirt);
  upper(13, 23, 1, 2, shade(skirt, 21));
  upper(19, 23, 1, 2, shade(skirt, -21));
  if (side) arm(13 - 2 * stride, 17, false);

  const colors = {
    '#': outline,
    h: hairColor,
    l: shade(hairColor, 24),
    L: shade(hairColor, 40),
    d: shade(hairColor, -23),
    s: skin,
    p: shade(skin, -26),
    m: '#ad6154',
    G: '#a27257',
    g: '#be9378',
    E: '#54322b',
    e: '#9e6142',
    w: '#fff3dc',
    t: '#dc8e49'
  };
  const head = walkHeads[side ? 'left' : direction];
  for (const [y, row] of head.entries()) {
    for (let x = 0; x < row.length; x++) {
      const color = colors[row[x]];
      if (color) upper(x + 7, y + 2, 1, 1, color);
    }
  }
  ctx.restore();
}

function characterMetadata(asset, settings) {
  return {
    assetName: asset.name,
    frameWidth: asset.width,
    frameHeight: asset.height,
    frameCount: asset.frames,
    rows: walkDirections.length,
    columns: asset.columns,
    directions: walkDirections,
    fps: asset.fps,
    loop: asset.loop,
    frameOrder: walkDirections.flatMap((direction, row) =>
      walkPoses.map((pose, column) => ({ index: row * asset.columns + column, direction, pose, row, column }))),
    seed: settings.seed,
    generatorSettings: { version: 1, shirtColor: settings.shirtColor, hairColor: settings.hairColor }
  };
}
