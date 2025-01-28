const nodemailer = require('nodemailer');
const User = require('../../models/User');

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: "tena.m.bsinfotech@gmail.com", // Your email
    pass: "mvyv jipv vbvh roup", // Your email password
  },
});

// Function to send ticket confirmation email
const sendTicketConfirmation = async (ticket, recipientEmail) => {
  const mailOptions = {
    from: "tena.m.bsinfotech@gmail.com", // Ensure this matches the user email in the transporter
    to: recipientEmail,
    subject: 'Ticket Confirmation',
    html: `<h1>Ticket Confirmation</h1>
           <p>Your ticket has been created successfully. Here are the details:</p>
           <ul>
             <li><strong>Ticket Number:</strong> ${ticket.ticketNumber}</li>
             <li><strong>Title:</strong> ${ticket.title}</li>
             <li><strong>Description:</strong> ${ticket.description}</li>
             <li><strong>Department:</strong> ${ticket.department}</li>
             <li><strong>Status:</strong> ${ticket.status}</li>
             <li><strong>Priority:</strong> ${ticket.priority}</li>
             <li><strong>Type:</strong> ${ticket.type}</li>
             <li><strong>Due Date:</strong> ${ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : 'N/A'}</li>
           </ul>
           <p>To track the status of your ticket, please visit the <a href="http://localhost:3000/tracking">Ticket Tracking Portal</a> portal.</p>
           <p>Thank you for contacting us.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Ticket confirmation email sent successfully.');
  } catch (error) {
    console.error('Error sending ticket confirmation email:', error);
  }
};

// Function to send account verification email
const sendAccountVerification = async (recipientEmail) => {
  const mailOptions = {
    from: "tena.m.bsinfotech@gmail.com", // Ensure this matches the user email in the transporter
    to: recipientEmail,
    subject: 'ITDesk - Account under review',
    html: `<h1>Thank you for registering with ITDesk</h1>
           <p>Your account is currently under review. You will receive an email once your account has been confirmed.</p>
           <p>Thank you for registering with ITDesk.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Account verification email sent successfully.');
  } catch (error) {
    console.error('Account verification email failed : ', error);
  }
}

// Function to send bulk emails
const sendBulkEmail = async (subject, htmlContent) => {
  try {
    // Get all users' emails
    const users = await User.find({}); // Fetch all users
    const emailList = users.map(user => user.email); // Extract emails

    // Send emails
    const promises = emailList.map(email => {
      return transporter.sendMail({
        from: "tena.m.bsinfotech@gmail.com",
        to: email,
        subject: subject,
        html: htmlContent,
      });
    });

    await Promise.all(promises);
    console.log('Bulk email sent successfully.');
  } catch (error) {
    console.error('Error sending bulk email:', error);
  }
};

module.exports = { sendTicketConfirmation, sendAccountVerification, sendBulkEmail };
