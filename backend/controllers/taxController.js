const IncomeTaxProfile = require('../models/IncomeTaxProfile');
const Employee = require('../models/Employee');

const calculateTax = (taxableIncome, regime) => {
    let tax = 0;
    if (regime === 'New') {
        if (taxableIncome <= 700000) return 0; // 87A Rebate
        if (taxableIncome > 300000) tax += Math.min(taxableIncome - 300000, 300000) * 0.05;
        if (taxableIncome > 600000) tax += Math.min(taxableIncome - 600000, 300000) * 0.10;
        if (taxableIncome > 900000) tax += Math.min(taxableIncome - 900000, 300000) * 0.15;
        if (taxableIncome > 1200000) tax += Math.min(taxableIncome - 1200000, 300000) * 0.20;
        if (taxableIncome > 1500000) tax += (taxableIncome - 1500000) * 0.30;
    } else {
        if (taxableIncome <= 500000) return 0; // 87A Rebate
        if (taxableIncome > 250000) tax += Math.min(taxableIncome - 250000, 250000) * 0.05;
        if (taxableIncome > 500000) tax += Math.min(taxableIncome - 500000, 500000) * 0.20;
        if (taxableIncome > 1000000) tax += (taxableIncome - 1000000) * 0.30;
    }
    // Add 4% Health & Education Cess
    return Math.round(tax * 1.04);
};

exports.getEmployeeTaxProfile = async (req, res) => {
    try {
        const employeeId = req.user.role === 'Employee' ? req.user.employeeId || req.user._id : req.params.employeeId;
        const financialYear = req.query.fy || (() => {
            const curr = new Date();
            const y = curr.getFullYear();
            const m = curr.getMonth();
            const startY = m < 3 ? y - 1 : y;
            return `${startY}-${(startY + 1).toString().slice(2)}`;
        })();

        if (!employeeId || employeeId === 'undefined' || !String(employeeId).match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ success: false, message: 'Invalid Employee ID' });
        }

        const emp = await Employee.findById(employeeId);
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

        let profile = await IncomeTaxProfile.findOne({ employee: employeeId, financialYear });

        // Sync from Employee Master
        const grossAnnual = (emp.gross || 0) * 12 || ((emp.salary?.basic || 0) + (emp.salary?.hra || 0) + (emp.salary?.allowances?.special || 0)) * 12;
        let regime = 'New';
        if (emp.taxRegime && emp.taxRegime.toLowerCase().includes('old')) regime = 'Old';
        else if (emp.salary?.taxRegime === 'Old') regime = 'Old';

        const declarations = {
            taxRegime: regime || 'New',
            annualGrossIncome: grossAnnual || 0,
            investments80C: emp?.inv80c || 0,
            medical80D: emp?.inv80d || 0,
            educationLoan80E: emp?.inv80e || 0,
            housingLoanInterest: emp?.homeLoanInterest || 0,
            hraExemption: emp?.hraClaimed || 0,
            otherIncome: emp?.other80 || 0,
            standardDeduction: regime === 'New' ? 75000 : 50000
        };

        if (!profile) {
            profile = new IncomeTaxProfile({
                employee: emp._id,
                financialYear: financialYear,
                ...declarations
            });
        } else {
            // Explicitly set fields to avoid issues with Object.assign on protected props
            profile.taxRegime = declarations.taxRegime;
            profile.annualGrossIncome = declarations.annualGrossIncome;
            profile.investments80C = declarations.investments80C;
            profile.medical80D = declarations.medical80D;
            profile.educationLoan80E = declarations.educationLoan80E;
            profile.housingLoanInterest = declarations.housingLoanInterest;
            profile.hraExemption = declarations.hraExemption;
            profile.otherIncome = declarations.otherIncome;
            profile.standardDeduction = declarations.standardDeduction;
        }

        // Recalculate
        const totalExemptions = Number(profile.standardDeduction) + (regime === 'Old' ? (profile.investments80C + profile.medical80D + profile.educationLoan80E + profile.housingLoanInterest + profile.hraExemption) : 0);
        profile.totalExemptions = totalExemptions;
        profile.taxableIncome = Math.max(grossAnnual + profile.otherIncome - totalExemptions, 0);
        profile.estimatedAnnualTax = calculateTax(profile.taxableIncome, regime);
        profile.monthlyTDS = Math.ceil(profile.estimatedAnnualTax / 12);

        await profile.save();
        res.json({ success: true, data: profile });
    } catch (err) {
        console.error("Error in getEmployeeTaxProfile:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateTaxDeclarations = async (req, res) => {
    try {
        const { employeeId, financialYear, taxRegime, investments80C, medical80D, nps80CCD, educationLoan80E, housingLoanInterest, hraExemption, otherIncome, standardDeduction } = req.body;

        const emp = await Employee.findById(employeeId);
        if (!emp) return res.status(404).json({ success: false, message: "Employee not found" });

        const gross = (emp.gross || 0) * 12 || ((emp.salary?.basic || 0) + (emp.salary?.hra || 0) + (emp.salary?.allowances?.special || 0)) * 12;

        let totalExemptions = Number(standardDeduction || 50000);

        if (taxRegime === 'Old') {
            totalExemptions += Number(investments80C || 0) + Number(medical80D || 0) + Number(nps80CCD || 0) + Number(educationLoan80E || 0) + Number(housingLoanInterest || 0) + Number(hraExemption || 0);
        }

        const taxableIncome = Math.max(gross + Number(otherIncome || 0) - totalExemptions, 0);
        const estimatedAnnualTax = calculateTax(taxableIncome, taxRegime);
        const monthlyTDS = Math.ceil(estimatedAnnualTax / 12);

        const profile = await IncomeTaxProfile.findOneAndUpdate(
            { employee: employeeId, financialYear },
            {
                ...req.body,
                annualGrossIncome: gross,
                totalExemptions,
                taxableIncome,
                estimatedAnnualTax,
                monthlyTDS
            },
            { new: true, upsert: true }
        );

        // Sync back to Employee Master
        if (emp) {
            emp.taxRegime = taxRegime === 'Old' ? 'Old regime' : 'New regime (FY 2025-26)';
            if (emp.salary) emp.salary.taxRegime = taxRegime;
            await emp.save();
        }

        res.json({ success: true, data: profile, message: 'Tax Profile Updated' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
