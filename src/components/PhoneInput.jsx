import React, { useState } from 'react';

/**
 * Global phone entry: a country-code dropdown + national number.
 *
 * Controlled by a single combined value — E.164 digits with no '+', e.g.
 * "916291745974" — the exact shape the WhatsApp binding stores and compares.
 * On mount we split the value into dial code + national part (longest dial-code
 * match wins, so +91 beats +9); every edit emits the recombined digits.
 */

// A broad, global set. Dial codes are digits only; flags are just decoration.
const COUNTRIES = [
    { iso: 'IN', name: 'India', dial: '91', flag: '🇮🇳' },
    { iso: 'US', name: 'United States', dial: '1', flag: '🇺🇸' },
    { iso: 'GB', name: 'United Kingdom', dial: '44', flag: '🇬🇧' },
    { iso: 'AE', name: 'United Arab Emirates', dial: '971', flag: '🇦🇪' },
    { iso: 'SG', name: 'Singapore', dial: '65', flag: '🇸🇬' },
    { iso: 'AU', name: 'Australia', dial: '61', flag: '🇦🇺' },
    { iso: 'CA', name: 'Canada', dial: '1', flag: '🇨🇦' },
    { iso: 'DE', name: 'Germany', dial: '49', flag: '🇩🇪' },
    { iso: 'FR', name: 'France', dial: '33', flag: '🇫🇷' },
    { iso: 'NL', name: 'Netherlands', dial: '31', flag: '🇳🇱' },
    { iso: 'IE', name: 'Ireland', dial: '353', flag: '🇮🇪' },
    { iso: 'ES', name: 'Spain', dial: '34', flag: '🇪🇸' },
    { iso: 'IT', name: 'Italy', dial: '39', flag: '🇮🇹' },
    { iso: 'CH', name: 'Switzerland', dial: '41', flag: '🇨🇭' },
    { iso: 'SE', name: 'Sweden', dial: '46', flag: '🇸🇪' },
    { iso: 'SA', name: 'Saudi Arabia', dial: '966', flag: '🇸🇦' },
    { iso: 'QA', name: 'Qatar', dial: '974', flag: '🇶🇦' },
    { iso: 'ZA', name: 'South Africa', dial: '27', flag: '🇿🇦' },
    { iso: 'NG', name: 'Nigeria', dial: '234', flag: '🇳🇬' },
    { iso: 'KE', name: 'Kenya', dial: '254', flag: '🇰🇪' },
    { iso: 'BR', name: 'Brazil', dial: '55', flag: '🇧🇷' },
    { iso: 'MX', name: 'Mexico', dial: '52', flag: '🇲🇽' },
    { iso: 'JP', name: 'Japan', dial: '81', flag: '🇯🇵' },
    { iso: 'CN', name: 'China', dial: '86', flag: '🇨🇳' },
    { iso: 'HK', name: 'Hong Kong', dial: '852', flag: '🇭🇰' },
    { iso: 'MY', name: 'Malaysia', dial: '60', flag: '🇲🇾' },
    { iso: 'ID', name: 'Indonesia', dial: '62', flag: '🇮🇩' },
    { iso: 'PH', name: 'Philippines', dial: '63', flag: '🇵🇭' },
    { iso: 'TH', name: 'Thailand', dial: '66', flag: '🇹🇭' },
    { iso: 'VN', name: 'Vietnam', dial: '84', flag: '🇻🇳' },
    { iso: 'BD', name: 'Bangladesh', dial: '880', flag: '🇧🇩' },
    { iso: 'PK', name: 'Pakistan', dial: '92', flag: '🇵🇰' },
    { iso: 'LK', name: 'Sri Lanka', dial: '94', flag: '🇱🇰' },
    { iso: 'NP', name: 'Nepal', dial: '977', flag: '🇳🇵' },
    { iso: 'NZ', name: 'New Zealand', dial: '64', flag: '🇳🇿' }
];

// Longest dial code first, so "+91" is preferred over "+9" when splitting.
const BY_LEN = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
const splitValue = (v) => {
    const digits = String(v || '').replace(/\D/g, '');
    const c = BY_LEN.find((x) => digits.startsWith(x.dial));
    return c ? { dial: c.dial, nat: digits.slice(c.dial.length) } : { dial: '91', nat: digits };
};

export default function PhoneInput({ value, onChange, disabled }) {
    const init = splitValue(value);
    const [dial, setDial] = useState(init.dial);
    const [nat, setNat] = useState(init.nat);

    const emit = (d, n) => onChange(`${d}${n}`.replace(/\D/g, ''));
    const onDial = (d) => { setDial(d); emit(d, nat); };
    const onNat = (raw) => { const n = raw.replace(/\D/g, '').slice(0, 12); setNat(n); emit(dial, n); };

    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <select value={dial} onChange={(e) => onDial(e.target.value)} disabled={disabled} style={{ maxWidth: 132, flex: '0 0 auto' }}>
                {/* value can repeat (US/Canada share +1); the label keeps them distinct */}
                {COUNTRIES.map((c) => <option key={c.iso} value={c.dial}>{c.flag} {c.iso} +{c.dial}</option>)}
            </select>
            <input
                type="tel"
                inputMode="numeric"
                value={nat}
                onChange={(e) => onNat(e.target.value)}
                disabled={disabled}
                placeholder="10-digit number"
                style={{ flex: 1, minWidth: 0 }}
            />
        </div>
    );
}
