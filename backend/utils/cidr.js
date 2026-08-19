// Pure-JS IPv4 CIDR matching — no Node-only APIs (no `net`, `ip`, `netmask`), so this
// stays usable in any runtime (Vercel functions, edge, etc). IPv6 / anything that isn't
// a clean dotted-quad falls back to exact string match rather than being rejected.

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Converts a dotted IPv4 string to a 32-bit unsigned integer, or null if invalid. */
function ipv4ToLong(ip) {
    const m = String(ip || '').trim().match(IPV4_RE);
    if (!m) return null;
    const octets = m.slice(1, 5).map(Number);
    if (octets.some((o) => o < 0 || o > 255)) return null;
    return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

function isIpv4(value) {
    return ipv4ToLong(value) !== null;
}

/** Accepts a bare IPv4 (implicit /32) or "a.b.c.d/nn" (nn 0-32). IPv6/other strings are
 *  considered valid too — they're matched by exact string equality at match time. */
function isValidCidr(cidr) {
    const value = String(cidr || '').trim();
    if (!value) return false;

    if (!value.includes('/')) {
        return isIpv4(value) || value.length > 0; // bare IPv4 or exact-match (e.g. IPv6) entry
    }

    const [base, prefixStr] = value.split('/');
    if (!isIpv4(base)) return false;
    if (!/^\d{1,2}$/.test(prefixStr)) return false;
    const prefix = Number(prefixStr);
    return prefix >= 0 && prefix <= 32;
}

/** True if `ip` falls inside `cidr`. Non-IPv4 CIDR entries fall back to exact string match. */
function ipMatchesCidr(ip, cidr) {
    const value = String(cidr || '').trim();
    if (!value) return false;

    const [base, prefixStr] = value.split('/');
    const baseLong = ipv4ToLong(base);
    const ipLong = ipv4ToLong(ip);

    if (baseLong === null || ipLong === null) {
        // Non-IPv4 (e.g. IPv6) — only exact string equality counts as a match.
        return String(ip || '').trim() === value;
    }

    const prefix = prefixStr === undefined ? 32 : Number(prefixStr);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    return (ipLong & mask) === (baseLong & mask);
}

function ipMatchesAnyCidr(ip, cidrList) {
    return (cidrList || []).some((cidr) => ipMatchesCidr(ip, cidr));
}

module.exports = { ipv4ToLong, isValidCidr, ipMatchesCidr, ipMatchesAnyCidr };
