const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'test_file.bin');
const fileSize = 100 * 1024 * 1024; // 100 MB

try {
    const buffer = Buffer.alloc(fileSize);
    fs.writeFileSync(filePath, buffer);
    console.log('Successfully wrote 100 MB');
    fs.unlinkSync(filePath);
} catch (err) {
    console.error('Failed to write 100 MB:', err);
}
