import { deflateSync } from "node:zlib";

const palettes = {
  cars: ["#111827", "#7f1d1d", "#f59e0b"],
  realestate: ["#172554", "#7c5c3b", "#f3d7a3"],
  mobiles: ["#111827", "#4c1d95", "#fb923c"],
  electronics: ["#0f172a", "#0e7490", "#f59e0b"],
  furniture: ["#29211d", "#7c4a2d", "#e7bd84"],
  jobs: ["#172033", "#475569", "#d99a32"],
  services: ["#12303a", "#0f766e", "#f59e0b"],
  fashion: ["#2b172b", "#9d174d", "#f8b45e"],
  food: ["#243119", "#6b6b20", "#e8a932"],
  animals: ["#253026", "#6b6341", "#dba94e"],
  education: ["#14233a", "#2563eb", "#e8a932"],
  business: ["#202326", "#52525b", "#e59a2e"],
  misc: ["#211f30", "#5b4b82", "#e59a32"],
};

function hex(value) {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

function surface(width, height, top, bottom) {
  const pixels = Buffer.alloc(width * height * 4);
  const a = hex(top);
  const b = hex(bottom);
  for (let y = 0; y < height; y += 1) {
    const t = y / Math.max(1, height - 1);
    const c = a.map((value, index) =>
      index === 3 ? 255 : Math.round(value * (1 - t) + b[index] * t),
    );
    for (let x = 0; x < width; x += 1) {
      const p = (y * width + x) * 4;
      pixels[p] = c[0];
      pixels[p + 1] = c[1];
      pixels[p + 2] = c[2];
      pixels[p + 3] = 255;
    }
  }
  return pixels;
}

function blend(pixels, width, height, x, y, rgba) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= width || py >= height) return;
  const offset = (py * width + px) * 4;
  const alpha = rgba[3] / 255;
  const inverse = 1 - alpha;
  pixels[offset] = Math.round(rgba[0] * alpha + pixels[offset] * inverse);
  pixels[offset + 1] = Math.round(rgba[1] * alpha + pixels[offset + 1] * inverse);
  pixels[offset + 2] = Math.round(rgba[2] * alpha + pixels[offset + 2] * inverse);
}

function rect(pixels, width, height, x, y, rectWidth, rectHeight, color) {
  const rgba = Array.isArray(color) ? color : hex(color);
  for (let py = Math.max(0, y); py < Math.min(height, y + rectHeight); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(width, x + rectWidth); px += 1) {
      blend(pixels, width, height, px, py, rgba);
    }
  }
}

function circle(pixels, width, height, centerX, centerY, radius, color, ring = false) {
  const rgba = Array.isArray(color) ? color : hex(color);
  const inner = ring ? Math.max(0, radius - 12) : 0;
  for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) {
    for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
      const distance = (x - centerX) ** 2 + (y - centerY) ** 2;
      if (distance <= radius ** 2 && distance >= inner ** 2) {
        blend(pixels, width, height, x, y, rgba);
      }
    }
  }
}

function line(pixels, width, height, x1, y1, x2, y2, thickness, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let index = 0; index <= steps; index += 1) {
    const t = steps ? index / steps : 0;
    circle(
      pixels,
      width,
      height,
      x1 + (x2 - x1) * t,
      y1 + (y2 - y1) * t,
      thickness / 2,
      color,
    );
  }
}

function polygon(pixels, width, height, points, color) {
  const rgba = Array.isArray(color) ? color : hex(color);
  const ys = points.map((point) => point[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
    const xs = [];
    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      if ((start[1] <= y && end[1] > y) || (end[1] <= y && start[1] > y)) {
        xs.push(start[0] + ((y - start[1]) * (end[0] - start[0])) / (end[1] - start[1]));
      }
    }
    xs.sort((a, b) => a - b);
    for (let index = 0; index < xs.length; index += 2) {
      for (let x = Math.ceil(xs[index]); x <= Math.floor(xs[index + 1] ?? xs[index]); x += 1) {
        blend(pixels, width, height, x, y, rgba);
      }
    }
  }
}

function panel(pixels, width, height, accent) {
  rect(pixels, width, height, 56, 42, width - 112, height - 84, [255, 255, 255, 18]);
  rect(pixels, width, height, 120, 450, width - 240, 68, [246, 239, 224, 230]);
  rect(pixels, width, height, 155, 480, width - 310, 16, [20, 22, 30, 36]);
  rect(pixels, width, height, 120, 450, 10, 68, [...hex(accent).slice(0, 3), 220]);
}

function scene(pixels, width, height, kind, variant, accent) {
  panel(pixels, width, height, accent);
  const white = "#f4efe5";
  const dark = "#17191f";
  const metal = "#b8bec4";
  const wood = "#965d3b";

  if (kind === "car") {
    const body = variant % 2 ? "#c33b3d" : "#d6d9dc";
    rect(pixels, width, height, 160, 300, 480, 120, body);
    polygon(pixels, width, height, [[235, 300], [315, 235], [485, 235], [565, 300]], body);
    rect(pixels, width, height, 320, 250, 150, 48, "#5f8294");
    circle(pixels, width, height, 260, 420, 48, dark);
    circle(pixels, width, height, 540, 420, 48, dark);
    circle(pixels, width, height, 260, 420, 22, metal);
    circle(pixels, width, height, 540, 420, 22, metal);
  } else if (kind === "apartment" || kind === "shop") {
    rect(pixels, width, height, 140, 120, 520, 320, white);
    rect(pixels, width, height, 185, 165, 190, 210, kind === "shop" ? "#365766" : "#8e694e");
    rect(pixels, width, height, 415, 165, 190, 210, "#5b8195");
    rect(pixels, width, height, 385, 165, 12, 210, accent);
  } else if (kind === "phone") {
    rect(pixels, width, height, 300, 105, 210, 340, dark);
    rect(pixels, width, height, 316, 122, 178, 306, variant % 2 ? "#7c3aed" : "#4f46e5");
    circle(pixels, width, height, 355, 160, 20, dark);
    circle(pixels, width, height, 402, 160, 20, dark);
    circle(pixels, width, height, 449, 160, 20, dark);
  } else if (kind === "laptop") {
    rect(pixels, width, height, 165, 135, 470, 265, dark);
    rect(pixels, width, height, 185, 155, 430, 220, variant % 2 ? "#16697a" : "#2b6e8b");
    polygon(pixels, width, height, [[145, 405], [655, 405], [585, 475], [215, 475]], metal);
  } else if (kind === "tv") {
    rect(pixels, width, height, 115, 105, 570, 320, dark);
    rect(pixels, width, height, 135, 125, 530, 280, variant % 2 ? "#1d7290" : "#285b8f");
    line(pixels, width, height, 400, 425, 400, 480, 24, metal);
  } else if (kind === "bedroom") {
    rect(pixels, width, height, 210, 235, 380, 170, wood);
    rect(pixels, width, height, 235, 260, 330, 120, "#e4d5bb");
    rect(pixels, width, height, 255, 180, 290, 85, "#b8794d");
    rect(pixels, width, height, 120, 150, 80, 255, "#7c4a2d");
    rect(pixels, width, height, 600, 150, 70, 255, "#7c4a2d");
  } else if (kind === "dining") {
    circle(pixels, width, height, 400, 315, 145, wood);
    rect(pixels, width, height, 375, 345, 50, 115, "#6d3d29");
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      circle(pixels, width, height, 400 + 220 * Math.cos(angle), 315 + 120 * Math.sin(angle), 38, "#bd8458");
    }
  } else if (kind === "job") {
    rect(pixels, width, height, 230, 140, 340, 290, white);
    circle(pixels, width, height, 400, 240, 72, accent);
    rect(pixels, width, height, 300, 315, 200, 90, "#475569");
  } else if (kind === "design") {
    rect(pixels, width, height, 170, 135, 460, 290, white);
    rect(pixels, width, height, 215, 180, 370, 200, "#374151");
    polygon(pixels, width, height, [[245, 345], [345, 235], [425, 310], [520, 215], [565, 345]], accent);
  } else if (kind === "repair") {
    rect(pixels, width, height, 285, 110, 230, 330, dark);
    line(pixels, width, height, 205, 170, 595, 420, 30, accent);
    line(pixels, width, height, 595, 170, 205, 420, 26, white);
  } else if (kind === "moving") {
    rect(pixels, width, height, 150, 245, 430, 160, white);
    rect(pixels, width, height, 520, 295, 130, 110, accent);
    circle(pixels, width, height, 255, 420, 42, dark);
    circle(pixels, width, height, 555, 420, 42, dark);
  } else if (kind === "watch") {
    rect(pixels, width, height, 360, 80, 80, 110, metal);
    rect(pixels, width, height, 360, 390, 80, 100, metal);
    circle(pixels, width, height, 400, 290, 135, metal);
    circle(pixels, width, height, 400, 290, 86, dark);
    line(pixels, width, height, 400, 290, 400, 235, 8, accent);
    line(pixels, width, height, 400, 290, 450, 315, 7, white);
  } else if (kind === "dress") {
    polygon(pixels, width, height, [[360, 110], [440, 110], [475, 240], [560, 455], [240, 455], [325, 240]], variant % 2 ? "#be185d" : "#9333ea");
    circle(pixels, width, height, 400, 100, 35, "#e8c9aa");
  } else if (kind === "oil") {
    rect(pixels, width, height, 325, 145, 150, 290, "#647b31");
    rect(pixels, width, height, 355, 95, 90, 65, dark);
    circle(pixels, width, height, 290, 390, 50, "#78913e");
    circle(pixels, width, height, 510, 390, 50, "#78913e");
  } else if (kind === "honey") {
    rect(pixels, width, height, 285, 170, 230, 260, "#dc971f");
    rect(pixels, width, height, 315, 120, 170, 65, "#59422f");
    for (let y = 235; y < 370; y += 55) {
      for (let x = 330; x < 500; x += 55) circle(pixels, width, height, x, y, 25, "#f3bd42");
    }
  } else if (kind === "sheep") {
    circle(pixels, width, height, 375, 300, 150, white);
    circle(pixels, width, height, 560, 300, 70, "#4b4036");
    rect(pixels, width, height, 290, 380, 25, 90, "#4b4036");
    rect(pixels, width, height, 455, 380, 25, 90, "#4b4036");
  } else if (kind === "birds") {
    circle(pixels, width, height, 330, 290, 80, variant % 2 ? "#2693b2" : "#e89734");
    circle(pixels, width, height, 485, 315, 70, variant % 2 ? "#e89734" : "#2693b2");
    circle(pixels, width, height, 385, 230, 38, white);
    circle(pixels, width, height, 535, 265, 34, white);
  } else if (kind === "english" || kind === "math") {
    rect(pixels, width, height, 165, 125, 470, 310, kind === "math" ? "#27566a" : white);
    for (let index = 0; index < 4; index += 1) {
      line(pixels, width, height, 230, 190 + index * 55, 565, 190 + index * 55, 9, index === 1 ? accent : kind === "math" ? white : "#365f86");
    }
  } else if (kind === "machine") {
    rect(pixels, width, height, 185, 145, 430, 280, metal);
    rect(pixels, width, height, 240, 100, 320, 65, white);
    for (let index = 0; index < 4; index += 1) rect(pixels, width, height, 240 + index * 82, 210, 55, 170, "#495057");
    rect(pixels, width, height, 205, 390, 390, 55, "#575d60");
  } else if (kind === "coffee") {
    rect(pixels, width, height, 190, 135, 420, 285, "#493a32");
    rect(pixels, width, height, 250, 190, 300, 170, metal);
    circle(pixels, width, height, 400, 355, 85, white);
    circle(pixels, width, height, 400, 355, 52, "#75472f");
  } else if (kind === "bike") {
    circle(pixels, width, height, 260, 380, 95, white, true);
    circle(pixels, width, height, 540, 380, 95, white, true);
    line(pixels, width, height, 260, 380, 390, 235, 17, accent);
    line(pixels, width, height, 390, 235, 540, 380, 17, accent);
    line(pixels, width, height, 260, 380, 540, 380, 17, accent);
    line(pixels, width, height, 390, 235, 450, 390, 17, accent);
  } else if (kind === "gym") {
    rect(pixels, width, height, 230, 155, 340, 245, "#44484e");
    line(pixels, width, height, 310, 205, 310, 455, 22, metal);
    line(pixels, width, height, 490, 205, 490, 455, 22, metal);
    line(pixels, width, height, 250, 220, 550, 220, 24, accent);
    circle(pixels, width, height, 400, 345, 72, white, true);
  }
}

let crcTable;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, value) => {
      let current = value;
      for (let index = 0; index < 8; index += 1) {
        current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
      }
      return current >>> 0;
    });
  }
  let checksum = 0xffffffff;
  for (const byte of buffer) checksum = crcTable[(checksum ^ byte) & 255] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return output;
}

export function renderDemoPng({ category, kind, variant = 0, width = 800, height = 600 }) {
  const [top, bottom, accent] = palettes[category] ?? palettes.misc;
  const pixels = surface(width, height, top, bottom);
  for (let index = 0; index < 9; index += 1) {
    const centerX = 80 + ((index * 137 + variant * 41) % 720);
    const centerY = 55 + ((index * 83 + variant * 29) % 490);
    const radius = 45 + ((index * 19) % 95);
    circle(pixels, width, height, centerX, centerY, radius, [...hex(accent).slice(0, 3), 18]);
  }
  scene(pixels, width, height, kind, variant, accent);

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
