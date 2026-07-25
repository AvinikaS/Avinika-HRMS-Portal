const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Send OTP email for password reset
 */
exports.sendOtpEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.SMTP_FROM || 'HRMS Portal <noreply@hrms.com>',
        to: email,
        subject: 'HRMS Password Reset OTP',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 700;">H</div>
                    <h2 style="margin: 12px 0 4px; color: #1e293b;">Password Reset</h2>
                    <p style="color: #64748b; font-size: 14px; margin: 0;">HRMS Portal</p>
                </div>
                <div style="background: white; border-radius: 10px; padding: 24px; border: 1px solid #e2e8f0;">
                    <p style="color: #334155; font-size: 14px; margin: 0 0 16px;">You requested a password reset. Use this OTP to verify your identity:</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <div style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; letter-spacing: 8px; font-size: 28px; font-weight: 700; color: white;">${otp}</div>
                    </div>
                    <p style="color: #ef4444; font-size: 13px; text-align: center; margin: 16px 0 0; font-weight: 600;">⏰ This OTP is valid for 5 minutes only.</p>
                </div>
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 20px 0 0;">If you didn't request this, please ignore this email. Your account is safe.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

/**
 * Send interview schedule email
 */
exports.sendInterviewEmail = async (email, candidateName, details) => {
    const { date, time, duration, interviewType, meetingLink, interviewerName } = details;
    const mailOptions = {
        from: process.env.SMTP_FROM || 'HRMS HR Team <noreply@hrms.com>',
        to: email,
        subject: `Interview Scheduled: ${interviewType || 'Interview'}`,
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1e293b; margin-top: 0;">Hi ${candidateName},</h2>
                <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                    We are pleased to inform you that your interview has been scheduled.
                </p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px; color: #334155;"><strong>📅 Date:</strong> ${date}</p>
                    <p style="margin: 0 0 10px; color: #334155;"><strong>⏰ Time:</strong> ${time}</p>
                    <p style="margin: 0 0 10px; color: #334155;"><strong>⏱️ Duration:</strong> ${duration} mins</p>
                    <p style="margin: 0 0 10px; color: #334155;"><strong>👤 Interviewer:</strong> ${interviewerName}</p>
                    <p style="margin: 0 0 10px; color: #334155;"><strong>🎥 Type:</strong> ${interviewType}</p>
                    ${interviewType === 'Phone Call' && meetingLink ? `<p style="margin: 0; color: #334155;"><strong>📞 Phone:</strong> ${meetingLink}</p>` : ''}
                    ${interviewType === 'In-Person' && meetingLink ? `<p style="margin: 0; color: #334155;"><strong>📍 Location:</strong> ${meetingLink}</p>` : ''}
                </div>
                ${interviewType === 'Video Call' && meetingLink ? `
                    <div style="margin: 24px 0; text-align: center;">
                        <a href="${meetingLink}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Join Meeting</a>
                        <p style="margin-top: 10px; font-size: 12px; color: #64748b;">Or use link: <a href="${meetingLink}">${meetingLink}</a></p>
                    </div>
                ` : ''}
                <p style="color: #64748b; font-size: 13px; margin: 0;">This is an automated notification. Please do not reply directly to this email.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

/**
 * Send happy birthday email
 */
exports.sendBirthdayEmail = async (email, employeeName) => {
    const mailOptions = {
        from: process.env.SMTP_FROM || 'HRMS Team <noreply@hrms.com>',
        to: email,
        subject: `🎉 Happy Birthday, ${employeeName}! 🎂`,
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: linear-gradient(135deg, #ffffff 0%, #fef3c7 100%); border-radius: 12px; border: 1px solid #fde68a; text-align: center;">
                <h1 style="color: #d97706; margin-top: 0; font-size: 28px;">Happy Birthday! 🎈</h1>
                <h2 style="color: #1e293b; margin: 10px 0;">${employeeName}</h2>
                <div style="font-size: 48px; margin: 20px 0;">🎂🎉🥳</div>
                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                    Wishing you a fantastic birthday and a wonderful year ahead filled with happiness and success!
                </p>
                <p style="color: #475569; font-size: 16px; margin-top: 20px;">
                    Best Wishes,<br><strong>Your Friends & Team at HRMS</strong>
                </p>
            </div>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email] Birthday email sent to ${email}`);
    } catch (err) {
        console.error(`[Email Error] Failed to send birthday email to ${email}`, err);
    }
};
