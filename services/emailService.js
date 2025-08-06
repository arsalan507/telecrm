// services/emailService.js - Email Service for Demo Requests
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
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

  async sendInternalAlert(requestData, leadScore, intentLevel) {
    try {
      const alertEmail = process.env.SALES_ALERT_EMAIL || 'sales@calltrackerpro.com';
      
      const subject = intentLevel === 'urgent' ? 
        '🚨 URGENT: High-Intent Demo Request' : 
        `🎯 New ${intentLevel.toUpperCase()} Intent Demo Request`;

      const htmlContent = `
        <h2>New Demo Request Alert</h2>
        <div style="background: #f0f0f0; padding: 20px; border-radius: 5px;">
          <h3>Contact Info</h3>
          <p><strong>Name:</strong> ${requestData.name}</p>
          <p><strong>Email:</strong> ${requestData.email}</p>
          
          <h3>Psychological Profile</h3>
          <p><strong>Trigger Event:</strong> ${requestData.triggerEvent}</p>
          <p><strong>Cost of Inaction:</strong> ${requestData.costOfInaction}</p>
          <p><strong>Personal Win:</strong> ${requestData.personalWin}</p>
          <p><strong>Decision Style:</strong> ${requestData.decisionStyle}/100 (${requestData.decisionStyle < 50 ? 'Data-driven' : 'Story-driven'})</p>
          
          <h3>Lead Intelligence</h3>
          <p><strong>Urgency Score:</strong> ${leadScore}/100</p>
          <p><strong>Intent Level:</strong> ${intentLevel.toUpperCase()}</p>
          <p><strong>Stakeholders:</strong> ${requestData.stakeholders?.join(', ') || 'Not specified'}</p>
          
          <h3>Magic Wand Insight</h3>
          <p>${requestData.magicWandInsight || 'Not provided'}</p>
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