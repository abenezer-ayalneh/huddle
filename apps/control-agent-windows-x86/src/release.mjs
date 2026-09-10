const minimumVersionKey = 'windows-control-agent-x86-minimum-version-v1';
const minimumWindowsKey = 'windows-control-agent-x86-minimum-windows-v1';

function validVersion(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

function validWindowsBuild(value) {
  return typeof value === 'string' && /^10\.0\.\d{5,}$/.test(value);
}

function validHttpsUrl(value) {
  try {
    return typeof value === 'string' && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validArtifact(value) {
  return (
    value &&
    typeof value === 'object' &&
    validHttpsUrl(value.url) &&
    typeof value.sha256 === 'string' &&
    /^[A-Fa-f0-9]{64}$/.test(value.sha256) &&
    Number.isSafeInteger(value.sizeBytes) &&
    value.sizeBytes > 0
  );
}

function compareVersions(left, right) {
  const core = (value) => value.split(/[-+]/, 1)[0].split('.').map(Number);
  const l = core(left);
  const r = core(right);
  for (let index = 0; index < 3; index += 1) {
    if (l[index] !== r[index]) return l[index] < r[index] ? -1 : 1;
  }
  if (left.includes('-') !== right.includes('-')) return left.includes('-') ? -1 : 1;
  return 0;
}

function compareWindowsVersions(left, right) {
  const l = left.split('.').map(Number);
  const r = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (l[index] !== r[index]) return l[index] < r[index] ? -1 : 1;
  }
  return 0;
}

function structuralManifest(value) {
  return (
    value &&
    typeof value === 'object' &&
    value.schemaVersion === 1 &&
    value.channel === 'beta' &&
    typeof value.keyId === 'string' &&
    validVersion(value.version) &&
    validVersion(value.minimumSupportedVersion) &&
    validWindowsBuild(value.minimumWindows) &&
    Number.isFinite(Date.parse(value.releasedAt ?? '')) &&
    validHttpsUrl(value.releaseNotesUrl) &&
    value.downloads &&
    typeof value.downloads === 'object'
  );
}

export async function checkRelease({ currentVersion, currentWindows, channelUrl, publicKey, verify }) {
  if (!channelUrl || !publicKey) return { configured: false, blocking: false, unsupportedWindows: false, missingNativeArchitecture: false };
  const cachedMinimum = localStorage.getItem(minimumVersionKey);
  const cachedMinimumWindows = localStorage.getItem(minimumWindowsKey);
  try {
    const channel = new URL(channelUrl);
    if (channel.protocol !== 'https:') throw new TypeError('Release channel must use HTTPS');
    const channelRoot = new URL(channel.href.endsWith('/') ? channel.href : `${channel.href}/`);
    const [manifestResponse, signatureResponse] = await Promise.all([
      fetch(new URL('release-manifest.json', channelRoot), { cache: 'no-store' }),
      fetch(new URL('release-manifest.sig', channelRoot), { cache: 'no-store' }),
    ]);
    if (!manifestResponse.ok || !signatureResponse.ok) throw new TypeError('Release channel is unavailable');
    const bytes = new Uint8Array(await manifestResponse.arrayBuffer());
    const signature = new Uint8Array(await signatureResponse.arrayBuffer());
    if (!(await verify(bytes, signature, publicKey))) throw new TypeError('Release manifest signature is invalid');
    const manifest = JSON.parse(new TextDecoder().decode(bytes));
    if (!structuralManifest(manifest)) throw new TypeError('Invalid release manifest');
    if (!validArtifact(manifest.downloads.x86)) {
      return { configured: true, blocking: false, unsupportedWindows: false, missingNativeArchitecture: true };
    }
    const minimum = !cachedMinimum || compareVersions(cachedMinimum, manifest.minimumSupportedVersion) < 0 ? manifest.minimumSupportedVersion : cachedMinimum;
    const minimumWindows =
      !cachedMinimumWindows || compareWindowsVersions(cachedMinimumWindows, manifest.minimumWindows) < 0 ? manifest.minimumWindows : cachedMinimumWindows;
    localStorage.setItem(minimumVersionKey, minimum);
    localStorage.setItem(minimumWindowsKey, minimumWindows);
    return {
      configured: true,
      blocking: compareVersions(currentVersion, minimum) < 0,
      unsupportedWindows: compareWindowsVersions(currentWindows, minimumWindows) < 0,
      missingNativeArchitecture: false,
      availableVersion: compareVersions(manifest.version, currentVersion) > 0 ? manifest.version : null,
    };
  } catch {
    return {
      configured: true,
      blocking: cachedMinimum ? compareVersions(currentVersion, cachedMinimum) < 0 : false,
      unsupportedWindows: cachedMinimumWindows ? compareWindowsVersions(currentWindows, cachedMinimumWindows) < 0 : false,
      missingNativeArchitecture: false,
    };
  }
}
