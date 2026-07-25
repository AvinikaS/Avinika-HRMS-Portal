/**
 * Calculate Indian Income Tax based on the slabs provided by the user.
 * 
 * Slabs:
 * 0 – 3,00,000 -> 0%
 * 3,00,000 – 6,00,000 -> 5%
 * 6,00,000 – 9,00,000 -> 10%
 * 9,00,000 – 12,00,000 -> 15%
 * 12,00,000 – 15,00,000 -> 20%
 * 15,00,000+ -> 30%
 * 
 * @param {number} yearlySalary Total annual gross earnings
 * @returns {number} Monthly TDS (Tax Deducted at Source)
 */
exports.calculateMonthlyTDS = (yearlySalary) => {
    let tax = 0;
    let income = yearlySalary;

    if (income > 1500000) {
        tax += (income - 1500000) * 0.30;
        income = 1500000;
    }
    if (income > 1200000) {
        tax += (income - 1200000) * 0.20;
        income = 1200000;
    }
    if (income > 900000) {
        tax += (income - 900000) * 0.15;
        income = 900000;
    }
    if (income > 600000) {
        tax += (income - 600000) * 0.10;
        income = 600000;
    }
    if (income > 300000) {
        tax += (income - 300000) * 0.05;
        income = 300000;
    }

    return Math.round(tax / 12);
};
