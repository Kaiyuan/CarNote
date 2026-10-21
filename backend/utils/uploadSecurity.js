const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
    'image/jpeg': { extension: '.jpg', detect: isJpeg },
    'image/png': { extension: '.png', detect: isPng },
    'image/webp': { extension: '.webp', detect: isWebp },
    'application/pdf': { extension: '.pdf', detect: isPdf }
};

function isJpeg(buffer) {
    return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
}

function isPng(buffer) {
    return buffer.length >= 8 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
}

function isWebp(buffer) {
    return buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP';
}

function isPdf(buffer) {
    return buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-';
}

function detectMimeType(filePath) {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');

    try {
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        const header = buffer.subarray(0, bytesRead);

        for (const [mimeType, config] of Object.entries(MIME_TYPES)) {
            if (config.detect(header)) return mimeType;
        }
    } finally {
        fs.closeSync(fd);
    }

    return null;
}

function getAllowedExtension(mimeType) {
    return MIME_TYPES[mimeType] ? MIME_TYPES[mimeType].extension : null;
}

/**
 * 校验上传文件的真实内容，并将扩展名修正为检测到的安全类型。
 * 不接受 SVG/HTML 等可执行主动内容的文件。
 */
function finalizeUploadedFile(file, allowedMimeTypes) {
    const detectedMimeType = detectMimeType(file.path);

    if (!detectedMimeType || !allowedMimeTypes.includes(detectedMimeType)) {
        return null;
    }

    const extension = getAllowedExtension(detectedMimeType);
    const currentExtension = path.extname(file.path);
    const targetPath = currentExtension === extension
        ? file.path
        : path.join(path.dirname(file.path), `${path.basename(file.path, currentExtension)}${extension}`);

    if (targetPath !== file.path) {
        fs.renameSync(file.path, targetPath);
        file.path = targetPath;
    }

    file.filename = path.basename(file.path);
    file.mimetype = detectedMimeType;

    return { mimeType: detectedMimeType, extension };
}

function removeFileQuietly(filePath) {
    try {
        if (filePath) fs.unlinkSync(filePath);
    } catch (error) {
        // 文件可能已被移动或删除，无需额外处理
    }
}

module.exports = {
    finalizeUploadedFile,
    removeFileQuietly
};
