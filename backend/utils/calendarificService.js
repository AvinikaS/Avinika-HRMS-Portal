// utils/calendarificService.js
const axios = require('axios');

const CALENDARIFIC_BASE = 'https://calendarific.com/api/v2';

/**
 * Calendarific se India ke holidays fetch karo
 * @param {number} year  - Jis saal ke holidays chahiye
 * @returns {Array}      - Formatted holiday objects
 */
const fetchIndiaHolidays = async (year) => {
    const apiKey = process.env.CALENDARIFIC_API_KEY;

    if (!apiKey) {
        throw new Error('CALENDARIFIC_API_KEY not found in .env file');
    }

    const url = `${CALENDARIFIC_BASE}/holidays`;

    const response = await axios.get(url, {
        params: {
            api_key: apiKey,
            country: 'IN',
            year: year,
            type: 'national',
        },
        timeout: 10000,
    });

    if (response.data.meta.code !== 200) {
        throw new Error(`Calendarific API error: ${response.data.meta.code}`);
    }

    const rawHolidays = response.data.response.holidays || [];

    return rawHolidays.map((h) => {
        const iso = h.date.iso;
        const type = mapCalendarificType(h.type);

        return {
            name: h.name,
            date: iso,
            type: type,
            description: h.description || '',
        };
    });
};

/**
 * Calendarific ke type array ko hamare enum mein map karo
 */
const mapCalendarificType = (types = []) => {
    const joined = types.join(' ').toLowerCase();

    if (joined.includes('national')) return 'Public';
    if (joined.includes('government')) return 'Government';
    if (joined.includes('optional') || joined.includes('observance')) return 'Optional';
    return 'Public';
};

module.exports = { fetchIndiaHolidays };
