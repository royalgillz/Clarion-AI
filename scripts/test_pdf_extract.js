const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('../public/sample_cbc_report.pdf');

pdf(dataBuffer).then(function(data) {
    console.log('=== EXTRACTED TEXT ===');
    console.log(data.text);
    console.log('\n=== LINES ===');
    const lines = data.text.split(/\r?\n/);
    lines.forEach((line, i) => {
        if (line.trim()) {
            console.log(`${i}: "${line}"`);
        }
    });
});
