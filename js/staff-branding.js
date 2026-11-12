// Themes the staff workspace with the selected school's colors and logo, and runs the School settings tab.
const brandingDefaults = { primary_color: '#002857', accent_color: '#f2b600' };
const logoTypes = ['image/png', 'image/jpeg', 'image/webp'];

// Saved colors win. Until the branding migration is applied, the demo schools use their
// logo-matched colors from data/sample-data.js, and anything else uses the conference colors.
function schoolColors(school) {
  // sampleSchools is a top-level const, so it is not a window property.
  const demo = school && typeof shoreSchools !== 'undefined' ? shoreSchools[school.slug]
    : school && typeof sampleSchools !== 'undefined' ? sampleSchools[school.slug] : null;
  return {
    primary: school?.primary_color || demo?.color || brandingDefaults.primary_color,
    accent: school?.accent_color || demo?.accent || brandingDefaults.accent_color,
  };
}

function schoolLogoUrl(client, school) {
  if (!school) return '';
  if (school.logo_path) return client.storage.from('school-logos').getPublicUrl(school.logo_path).data.publicUrl;
  return typeof shoreSchools !== 'undefined' ? shoreSchools[school.slug]?.logo ?? 'assets/logos/shore-conference.svg'
    : 'assets/logos/' + school.slug + '.png';
}

function schoolLogoBackground(school) {
  return !school?.logo_path && typeof shoreSchools !== 'undefined'
    ? shoreSchools[school?.slug]?.logoBackground : 'transparent';
}

function setSchoolColors(element, primary, accent) {
  element.style.setProperty('--school-color', primary);
  element.style.setProperty('--school-ink', readableInk(primary));
  element.style.setProperty('--school-accent', accent);
  element.style.setProperty('--accent-ink', readableInk(accent));
}

function applySchoolTheme(client, school) {
  const workspace = document.getElementById('workspace');
  const heading = workspace.querySelector('.staff-heading');
  const logo = document.getElementById('workspace-logo');
  const colors = schoolColors(school);
  setSchoolColors(workspace, colors.primary, colors.accent);
  const url = schoolLogoUrl(client, school);
  heading.querySelector('.logo-wall')?.remove();
  logo.hidden = !url;
  if (!url) return;
  logo.onerror = () => {
    logo.hidden = true;
    heading.querySelector('.logo-wall')?.remove();
  };
  logo.src = url;
  buildLogoWall(heading, url, 5, 24, schoolLogoBackground(school));
}

function luminance(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255]
    .map(channel => (channel /= 255) <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function toHex(red, green, blue) {
  return '#' + [red, green, blue].map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
}

// Reads a logo's main colors and turns them into up to three main/accent pairs.
function suggestSchemes(image) {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, size, size);
  let pixels;
  try {
    pixels = context.getImageData(0, 0, size, size).data;
  } catch {
    return [];
  }
  const buckets = new Map();
  let counted = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const [red, green, blue, alpha] = pixels.slice(index, index + 4);
    if (alpha < 200 || (red > 238 && green > 238 && blue > 238)) continue;
    const key = (red >> 5) + ',' + (green >> 5) + ',' + (blue >> 5);
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count++;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
    counted++;
  }
  const colors = [];
  for (const bucket of [...buckets.values()].sort((a, b) => b.count - a.count)) {
    if (bucket.count < counted * 0.03) break;
    const rgb = [bucket.red, bucket.green, bucket.blue].map(total => total / bucket.count);
    if (colors.every(color => Math.hypot(...color.rgb.map((value, index) => value - rgb[index])) > 70)) {
      colors.push({ rgb, hex: toHex(...rgb) });
    }
    if (colors.length === 3) break;
  }
  if (!colors.length) return [];
  const tint = color => toHex(...color.rgb.map(value => value + (255 - value) * 0.75));
  const pair = (first, second) => luminance(first) <= luminance(second)
    ? { primary: first, accent: second } : { primary: second, accent: first };
  const [first, second, third] = colors;
  const schemes = second
    ? [pair(first.hex, second.hex), third ? pair(first.hex, third.hex) : null, pair(first.hex, '#ffffff')]
    : [pair(first.hex, '#ffffff'), pair(first.hex, tint(first))];
  const seen = new Set();
  return schemes.filter(scheme => scheme && !seen.has(scheme.primary + scheme.accent) &&
    seen.add(scheme.primary + scheme.accent));
}

function startStaffSettings(client, currentSchool, onSaved) {
  const form = document.getElementById('branding-form');
  const fields = form.elements;
  const fileInput = document.getElementById('branding-logo-file');
  const currentLogo = document.getElementById('branding-logo-current');
  const suggest = document.getElementById('branding-suggest');
  const schemeList = document.getElementById('branding-schemes');
  const contrast = document.getElementById('branding-contrast');
  const status = document.getElementById('branding-status');
  const undo = document.getElementById('branding-undo');
  const save = form.querySelector('[type="submit"]');
  const preview = document.getElementById('branding-preview');
  const previewLogo = preview.querySelector('.branding-preview-logo');
  let file = null;
  let fileUrl = '';
  let active = true;

  function logoUrl() {
    return fileUrl || schoolLogoUrl(client, currentSchool());
  }

  function render() {
    const school = currentSchool();
    const primary = fields.primary_color.value;
    const accent = fields.accent_color.value;
    setSchoolColors(preview, primary, accent);
    preview.querySelector('.branding-preview-name').textContent = school?.name ?? '';
    previewLogo.hidden = !logoUrl();
    previewLogo.src = logoUrl();
    if (logoUrl()) buildLogoWall(preview, logoUrl(), 4, 16, fileUrl ? 'transparent' : schoolLogoBackground(school));
    const weak = contrastRatio(primary, accent) < 2.5;
    contrast.classList.toggle('is-warning', weak);
    contrast.textContent = weak
      ? 'The accent color is hard to see on the main color. Pick a lighter or darker accent.'
      : 'Text on the main color will be ' + (readableInk(primary) === '#ffffff' ? 'white' : 'black') + ' so it stays readable.';
  }

  function load() {
    const school = currentSchool();
    if (!school) return;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    file = null;
    fileUrl = '';
    form.reset();
    document.getElementById('settings-school').textContent = school.name;
    const colors = schoolColors(school);
    fields.primary_color.value = colors.primary;
    fields.accent_color.value = colors.accent;
    currentLogo.hidden = false;
    currentLogo.onerror = () => { currentLogo.hidden = true; };
    currentLogo.src = schoolLogoUrl(client, school);
    schemeList.replaceChildren();
    status.textContent = '';
    save.disabled = false;
    render();
  }

  async function showSchemes(applyFirst) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = logoUrl();
    try {
      await image.decode();
    } catch {
      status.textContent = 'The logo could not be read. Pick colors by hand.';
      return;
    }
    if (!active) return;
    const schemes = suggestSchemes(image);
    if (!schemes.length) {
      schemeList.replaceChildren();
      status.textContent = 'No clear colors were found in this logo. Pick colors by hand.';
      return;
    }
    schemeList.replaceChildren(...schemes.map((scheme, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'branding-scheme';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', 'Scheme ' + (index + 1) + ': main ' + scheme.primary + ', accent ' + scheme.accent);
      for (const color of [scheme.primary, scheme.accent]) {
        const swatch = document.createElement('span');
        swatch.style.background = color;
        button.append(swatch);
      }
      button.append('Scheme ' + (index + 1));
      button.onclick = () => pick(scheme, button);
      item.append(button);
      return item;
    }));
    if (applyFirst) {
      pick(schemes[0], schemeList.querySelector('button'));
      status.textContent = 'Colors picked from your logo. Choose another scheme or adjust them.';
    } else {
      status.textContent = 'Choose a scheme to try it in the preview.';
    }
  }

  function pick(scheme, button) {
    fields.primary_color.value = scheme.primary;
    fields.accent_color.value = scheme.accent;
    schemeList.querySelectorAll('button').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    render();
  }

  fileInput.onchange = () => {
    const chosen = fileInput.files[0];
    if (!chosen) return;
    if (!logoTypes.includes(chosen.type) || chosen.size > 1048576) {
      fileInput.value = '';
      status.textContent = 'Use a PNG, JPEG, or WebP logo up to 1 MB.';
      return;
    }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    file = chosen;
    fileUrl = URL.createObjectURL(chosen);
    render();
    showSchemes(true);
  };
  suggest.onclick = () => showSchemes(false);
  fields.primary_color.oninput = fields.accent_color.oninput = () => {
    schemeList.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', 'false'));
    render();
  };
  undo.onclick = load;

  form.onsubmit = async event => {
    event.preventDefault();
    const school = currentSchool();
    const oldPath = school.logo_path;
    let logoPath = oldPath ?? null;
    save.disabled = true;
    status.textContent = 'Saving…';
    if (file) {
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
      logoPath = school.slug + '/logo-' + Date.now() + '.' + extension;
      const { error } = await client.storage.from('school-logos')
        .upload(logoPath, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (!active) return;
      if (error) {
        status.textContent = 'The logo could not be uploaded. Check the file and try again.';
        save.disabled = false;
        return;
      }
    }
    const changes = {
      primary_color: fields.primary_color.value.toLowerCase(),
      accent_color: fields.accent_color.value.toLowerCase(),
      logo_path: logoPath,
    };
    const { data, error } = await client.from('schools').update(changes).eq('slug', school.slug).select('slug');
    if (!active) return;
    if (error || !data?.length) {
      status.textContent = 'The logo and colors weren’t saved. Your account may not manage this school.';
      save.disabled = false;
      return;
    }
    if (file && oldPath && oldPath !== logoPath) await client.storage.from('school-logos').remove([oldPath]);
    Object.assign(school, changes);
    onSaved(school);
    load();
    status.textContent = 'Logo and colors saved.';
  };

  return {
    load,
    stop() {
      active = false;
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      form.onsubmit = fileInput.onchange = suggest.onclick = undo.onclick = null;
    },
  };
}
