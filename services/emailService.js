// services/emailService.js - Email Service for Demo Requests
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (error) {
  console.warn('⚠️ Nodemailer not available. Email features disabled.');
}

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!nodemailer) {
      console.warn('⚠️ Email service disabled - nodemailer not available');
      return;
    }
    
    // Configure based on environment
    if (process.env.NODE_ENV === 'production') {
      // Production email configuration (e.g., SendGrid, AWS SES, etc.)
      this.transporter = nodemailer.createTransporter({
        service: 'SendGrid', // or your preferred service
        auth: {
          user: process.env.SENDGRID_USERNAME || 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else {
      // Development/testing configuration
      this.transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass'
        }
      });
    }
  }

  async sendDemoConfirmation(recipientEmail, personalizedContent, requestData) {
    if (!this.transporter) {
      console.warn('📧 Email service not configured - skipping confirmation email');
      return { success: false, error: 'Email service not available' };
    }
    
    try {
      const { subject, greeting, personalNote, urgencyNote } = personalizedContent;
      
      const htmlContent = this.generateDemoConfirmationHTML(
        greeting, 
        personalNote, 
        urgencyNote, 
        requestData
      );

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'demos@calltrackerpro.com',
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        text: this.generatePlainTextVersion(greeting, personalNote, urgencyNote)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Demo confirmation email sent:', result.messageId);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  generateDemoConfirmationHTML(greeting, personalNote, urgencyNote, requestData) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Demo Confirmation - CallTracker Pro</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .urgency-banner { background: #ff6b6b; color: white; padding: 15px; margin-bottom: 20px; border-radius: 5px; text-align: center; font-weight: bold; }
            .cta-button { background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; font-weight: bold; }
            .insights { background: white; padding: 20px; border-left: 5px solid #667eea; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚀 Your CallTracker Pro Demo is Confirmed!</h1>
            <p>Get ready to transform your call tracking game</p>
        </div>
        
        <div class="content">
            ${urgencyNote ? `<div class="urgency-banner">${urgencyNote}</div>` : ''}
            
            <p><strong>Hi ${requestData.name},</strong></p>
            
            <p>${greeting}</p>
            
            <p>${personalNote}</p>
            
            <div class="insights">
                <h3>🎯 What We'll Show You</h3>
                <p>Based on your priorities, we'll focus on:</p>
                <ul>
                    ${requestData.victoryPriorities?.map(priority => `<li>${this.formatPriority(priority)}</li>`).join('') || '<li>Complete call tracking solution overview</li>'}
                </ul>
            </div>
            
            <div class="insights">
                <h3>⏰ Next Steps</h3>
                <p><strong>Preferred Time:</strong> ${requestData.bestDemoTime}</p>
                <p><strong>Demo Length:</strong> ${requestData.preferredDemoLength}</p>
                <p>Our team will contact you within 24 hours to schedule your personalized demo.</p>
            </div>
            
            <a href="https://calltrackerpro.com/prepare-for-demo" class="cta-button">📋 Prepare for Your Demo</a>
            
            <p><strong>Questions before we meet?</strong><br>
            Reply to this email or call us at (555) 123-CALL</p>
            
            <p>Looking forward to showing you how CallTracker Pro can solve your attribution challenges!</p>
            
            <p>Best regards,<br>
            The CallTracker Pro Team</p>
        </div>
        
        <div class="footer">
            <p>CallTracker Pro | Advanced Call Tracking & Attribution</p>
            <p>This email was sent because you requested a demo at calltrackerpro.com</p>
        </div>
    </body>
    </html>
    `;
  }

  generatePlainTextVersion(greeting, personalNote, urgencyNote) {
    return `
    CallTracker Pro Demo Confirmation
    
    ${urgencyNote ? `URGENT: ${urgencyNote}` : ''}
    
    ${greeting}
    
    ${personalNote}
    
    Our team will contact you within 24 hours to schedule your personalized demo.
    
    Questions? Reply to this email or call (555) 123-CALL
    
    Best regards,
    The CallTracker Pro Team
    `;
  }

  formatPriority(priority) {
    const priorityMap = {
      'prove-roi': 'Proving ROI on marketing spend',
      'eliminate-waste': 'Eliminating wasted ad spend',
      'improve-sales': 'Improving sales conversion tracking',
      'save-client': 'Saving client relationships',
      'discover-sources': 'Discovering top lead sources',
      'streamline-reporting': 'Streamlining attribution reporting',
      'fix-call-handling': 'Fixing call handling processes',
      'beat-competitors': 'Staying ahead of competitors'
    };
    return priorityMap[priority] || priority;
  }

  async sendInternalAlert(requestData, leadScore, priority) {
    if (!this.transporter) {
      console.warn('📧 Email service not configured - skipping internal alert');
      return;
    }
    
    try {
      const alertEmail = process.env.SALES_ALERT_EMAIL || 'sales@calltrackerpro.com';
      
      const subject = requestData.urgency === 'urgent' ? 
        '🚨 URGENT: High-Priority Demo Request' : 
        `🎯 New ${priority.toUpperCase()} Priority Demo Request`;

      const painPointLabels = {
        'wasted-ad-spend': 'Can\'t track which campaigns drive calls',
        'poor-roi-tracking': 'Can\'t prove ROI to clients/management',
        'missed-opportunities': 'Missing calls or losing deals',
        'manual-tracking': 'Time-consuming manual processes',
        'competitor-advantage': 'Competitors have better insights',
        'other': 'Custom pain point'
      };

      const htmlContent = `
        <h2>New Demo Request Alert - ${priority.toUpperCase()} Priority</h2>
        <div style="background: #f0f0f0; padding: 20px; border-radius: 5px;">
          <h3>Contact Information</h3>
          <p><strong>Name:</strong> ${requestData.name}</p>
          <p><strong>Email:</strong> ${requestData.email}</p>
          <p><strong>Company:</strong> ${requestData.company || 'Not provided'}</p>
          <p><strong>Phone:</strong> ${requestData.phone || 'Not provided'}</p>
          
          <h3>Sales Qualification</h3>
          <p><strong>Urgency:</strong> ${requestData.urgency?.toUpperCase()}</p>
          <p><strong>Pain Point:</strong> ${painPointLabels[requestData.currentPain] || 'Not specified'}</p>
          <p><strong>Budget:</strong> ${requestData.budget || 'Not specified'}</p>
          <p><strong>Timeline:</strong> ${requestData.timeline || 'Not specified'}</p>
          <p><strong>Segment:</strong> ${requestData.segment || 'Unknown'}</p>
          
          <h3>Lead Intelligence</h3>
          <p><strong>Lead Score:</strong> ${leadScore}/100</p>
          <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
          
          <h3>Follow-up Actions</h3>
          <ul>
            ${requestData.followUpActions?.map(action => `<li>${action}</li>`).join('') || '<li>Standard follow-up process</li>'}
          </ul>
          
          <h3>Additional Message</h3>
          <p>${requestData.message || 'No additional message provided'}</p>
        </div>
      `;

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'alerts@calltrackerpro.com',
        to: alertEmail,
        subject: subject,
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      console.log('✅ Internal sales alert sent');

    } catch (error) {
      console.error('❌ Internal alert failed:', error);
    }
  }
}

module.exports = new EmailService();