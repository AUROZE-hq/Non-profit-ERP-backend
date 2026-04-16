const PDFDocument = require('pdfkit');
import fs from 'fs';
import path from 'path';

function resolveLogoPath() {
  return path.join(__dirname, '..', 'public', 'logo.png');
}

/**
 * Generate a Feedback Review PDF
 * @param feedback The feedback review document from Mongoose
 * @returns Path to the generated PDF file
 */
export async function generateFeedbackPDF(feedback: any) {
  return new Promise<string>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const fileName = `feedback_${feedback.reviewKey}_completed.pdf`;
      const tempDir = path.join(__dirname, '..', 'temp');
      
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const filePath = path.join(tempDir, fileName);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      const companyName = process.env.COMPANY_NAME || 'LOVECRY THE STREET KIDS ORGANIZATION';
      
      const participantName = feedback.recipient.firstName + ' ' + feedback.recipient.lastName;
      const eventDate = new Date(feedback.eventDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      // --- Logo (centered, optional) ---
      const logoPath = resolveLogoPath();
      if (fs.existsSync(logoPath)) {
        const logoWidth = 90;
        const logoX = (doc.page.width - logoWidth) / 2;
        doc.image(logoPath, logoX, doc.y, { width: logoWidth });
        doc.moveDown(4);
      }

      // --- Organization header ---
      doc.font('Helvetica-Bold').fontSize(14).text(companyName, { align: 'center' });
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(12).text('Feedback Form Responses', { align: 'center' });
      doc.moveDown(2);

      // --- Meta details ---
      doc.font('Helvetica-Bold').fontSize(11).text('Participant Details:');
      doc.font('Helvetica').fontSize(11)
        .text(`Name: ${participantName}`)
        .text(`Email: ${feedback.recipient.email}`)
        .text(`Phone: ${feedback.recipient.phoneNumber || 'N/A'}`);
        
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(11).text('Event Details:');
      doc.font('Helvetica').fontSize(11)
        .text(`Event: ${feedback.eventTitle || 'Unspecified Event'}`)
        .text(`Date: ${eventDate}`)
        .text(`Submitted On: ${feedback.respondedAt ? new Date(feedback.respondedAt).toLocaleString() : new Date().toLocaleString()}`);
        
      doc.moveDown(2);
      
      // --- Scales ---
      const Scales = {
        disagree: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
        dissatisfied: ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'],
        length: ['Too Short', 'Slightly Short', 'Just Right', 'Slightly Long', 'Too Long'],
        frequency: ['Not at all (0)', 'Several days (1)', 'More than half the days (2)', 'Nearly every day (3)']
      };

      // --- Helper to render question groups ---
      const printChecklistQuestion = (qText: string, selectedAns: string, options: string[]) => {
        doc.font('Helvetica-Bold').fontSize(10).text(qText);
        doc.moveDown(0.3);
        
        const optionsLine = options.map(opt => {
          const mark = opt === selectedAns ? '[ X ]' : '[   ]';
          return `${mark} ${opt}`;
        }).join('   |   ');
        
        doc.font('Helvetica').fontSize(9).text(optionsLine, {
          lineGap: 4
        });
        doc.moveDown(1);
      };

      const printQuestionGroup = (title: string, answers: string[], scaleType: keyof typeof Scales) => {
        if (!answers || answers.length === 0) return;
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text(title);
        doc.fillColor('black');
        doc.moveDown(0.5);
        
        const options = Scales[scaleType];
        answers.forEach(ansRaw => {
            let q = ansRaw;
            let a = '';
            for (const opt of options) {
              if (ansRaw.endsWith(`: ${opt}`)) {
                a = opt;
                q = ansRaw.substring(0, ansRaw.length - opt.length - 2);
                break;
              }
            }
            // Fallback if not matched
            if (!a) {
                const splitIdx = ansRaw.lastIndexOf(': ');
                if (splitIdx !== -1) {
                  q = ansRaw.substring(0, splitIdx);
                  a = ansRaw.substring(splitIdx + 2);
                }
            }
            printChecklistQuestion(q, a, options);
        });
        doc.moveDown(0.5);
      };

      const ans = feedback.answers || {};

      printQuestionGroup('Today’s Session Experience', ans.sessionExperience, 'disagree');
      printQuestionGroup('Group Connection', ans.groupConnection, 'dissatisfied');
      printQuestionGroup('Personal Impact', ans.personalImpact, 'disagree');
      printQuestionGroup('Session Structure', ans.sessionStructure, 'length');
      
      if (ans.expectationsMet) {
          doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('Expectations Met');
          doc.fillColor('black');
          doc.moveDown(0.5);
          printChecklistQuestion('Overall expectations', ans.expectationsMet, ['Beyond my expectations', 'Met as expected', 'Below my expectations']);
      }
      
      printQuestionGroup('Over the past week', ans.weeklyWellbeing, 'frequency');

      if (ans.optionalFeedback) {
          doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('Optional Feedback');
          doc.fillColor('black');
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').fontSize(10).text('How could we improve future sessions or what topics would you like to see next time?');
          doc.moveDown(0.3);
          doc.font('Helvetica').fontSize(10).text(ans.optionalFeedback, {
              align: 'left',
              lineGap: 4
          });
          doc.moveDown(1.5);
      }

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}
