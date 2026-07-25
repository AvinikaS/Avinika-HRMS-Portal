const Employee = require('../models/Employee');
const User = require('../models/User');
const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');

// GET /api/employees
exports.getEmployees = async (req, res) => {
    try {
        const { department, status, search, page = 1, limit = 20 } = req.query;
        const query = {};
        if (department) query.department = department;
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { employeeCode: { $regex: search, $options: 'i' } }
            ];
        }
        const employees = await Employee.find(query)
            .populate('reportingManager', 'firstName lastName')
            .populate('shift', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        const total = await Employee.countDocuments(query);
        res.json({ success: true, data: employees, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/employees/:id
exports.getEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id)
            .populate('reportingManager', 'firstName lastName email')
            .populate('shift');
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
        res.json({ success: true, data: employee });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/employees
exports.createEmployee = async (req, res) => {
    try {
        // Find the last employee code to avoid duplicates
        const lastEmployee = await Employee.findOne().sort({ employeeCode: -1 }).select('employeeCode');
        let nextNumber = 1;

        if (lastEmployee && lastEmployee.employeeCode) {
            const lastNumber = parseInt(lastEmployee.employeeCode.replace('EMP', ''));
            if (!isNaN(lastNumber)) {
                nextNumber = lastNumber + 1;
            }
        }

        const employeeCode = `EMP${String(nextNumber).padStart(4, '0')}`;
        const employee = await Employee.create({ ...req.body, employeeCode });
        // Create user account
        const user = await User.create({
            email: employee.email,
            password: 'Welcome@123',
            role: req.body.role || 'Employee',
            employeeId: employee._id
        });
        employee.userId = user._id;
        await employee.save();
        res.status(201).json({ success: true, data: employee });
    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(400).json({ success: false, message: `An employee with this ${field} already exists.` });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/employees/:id
exports.updateEmployee = async (req, res) => {
    try {
        const { email } = req.body;

        // Find existing employee to check for email change
        const existingEmployee = await Employee.findById(req.params.id);
        if (!existingEmployee) return res.status(404).json({ success: false, message: 'Employee not found' });

        // If email is changing, check if it already exists in User collection
        if (email && email.toLowerCase() !== existingEmployee.email.toLowerCase()) {
            const userExists = await User.findOne({ email: email.toLowerCase() });
            if (userExists && userExists.employeeId?.toString() !== req.params.id) {
                return res.status(400).json({ success: false, message: 'This email is already in use by another user' });
            }
        }

        const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

        // Synchronize email change to User account
        if (email) {
            await User.findOneAndUpdate(
                { employeeId: employee._id },
                { email: email.toLowerCase() }
            );
        }

        res.json({ success: true, data: employee });
    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(400).json({ success: false, message: `An employee with this ${field} already exists.` });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/employees/:id  (soft delete - set status to Inactive)
exports.deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndUpdate(req.params.id, {
            status: 'Inactive',
            dateOfLeaving: new Date()
        }, { new: true });
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
        await User.findOneAndUpdate({ employeeId: employee._id }, { isActive: false });
        res.json({ success: true, message: 'Employee deactivated', data: employee });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/employees/departments/list
exports.getDepartments = async (req, res) => {
    try {
        const departments = await Employee.distinct('department');
        res.json({ success: true, data: departments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/employees/:id/profile-image (Admin)
exports.uploadEmployeeImage = async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) {
            return res.status(400).json({ success: false, message: 'Please upload an image' });
        }
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        // Delete old image from Cloudinary if exists
        if (employee.profileImage) {
            const oldPublicId = getPublicIdFromUrl(employee.profileImage);
            await deleteFromCloudinary(oldPublicId);
        }

        // Update using findByIdAndUpdate to bypass validation errors on legacy fields
        await Employee.findByIdAndUpdate(employee._id, { profileImage: imageUrl });

        res.json({ success: true, message: 'Profile image uploaded', data: employee });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/employees/:id/profile-image (Admin)
exports.deleteEmployeeImage = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        if (employee.profileImage) {
            const publicId = getPublicIdFromUrl(employee.profileImage);
            await deleteFromCloudinary(publicId);
            // Update using findByIdAndUpdate to bypass validation errors on legacy fields
            await Employee.findByIdAndUpdate(employee._id, { profileImage: null });
        }

        res.json({ success: true, message: 'Profile image deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
