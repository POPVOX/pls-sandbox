// Document Parser Service
// Extracts text from PDF, Word, and text files

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker using the legacy build which doesn't require a separate worker
// This avoids worker loading issues in Vite/modern bundlers
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

/**
 * Extract text from a PDF file
 */
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map(item => item.str)
            .join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText.trim();
}

/**
 * Extract text from a Word document (.docx)
 */
async function extractTextFromWord(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

/**
 * Extract text from a plain text file
 */
async function extractTextFromTxt(file) {
    return await file.text();
}

/**
 * Main function to extract text from any supported file type
 */
export async function extractTextFromDocument(file) {
    const fileName = file.name.toLowerCase();

    try {
        if (fileName.endsWith('.pdf')) {
            return await extractTextFromPDF(file);
        } else if (fileName.endsWith('.docx')) {
            return await extractTextFromWord(file);
        } else if (fileName.endsWith('.doc')) {
            // .doc files are legacy format, mammoth might not support them fully
            // Try mammoth first, fall back to error message
            try {
                return await extractTextFromWord(file);
            } catch (e) {
                throw new Error('Legacy .doc format is not fully supported. Please convert to .docx or PDF.');
            }
        } else if (fileName.endsWith('.txt')) {
            return await extractTextFromTxt(file);
        } else {
            throw new Error(`Unsupported file type: ${fileName}`);
        }
    } catch (error) {
        console.error('Error extracting text from document:', error);
        throw new Error(`Failed to extract text: ${error.message}`);
    }
}

/**
 * Get basic info about the document
 */
export async function getDocumentInfo(file) {
    const info = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified),
    };

    if (file.name.toLowerCase().endsWith('.pdf')) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            info.pageCount = pdf.numPages;

            const metadata = await pdf.getMetadata();
            if (metadata.info) {
                info.title = metadata.info.Title || null;
                info.author = metadata.info.Author || null;
                info.subject = metadata.info.Subject || null;
                info.creationDate = metadata.info.CreationDate || null;
            }
        } catch (e) {
            console.warn('Could not extract PDF metadata:', e);
        }
    }

    return info;
}
