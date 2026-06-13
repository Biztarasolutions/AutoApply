import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, file, mimeType } = body;

    // Static resolution of backend modules
    const { parseResume } = require('../../../../backend/ai/parser');

    let parsedData;
    if (file && mimeType) {
      // Parse base64 file content (e.g. PDF)
      parsedData = await parseResume(file, mimeType);
    } else if (text && text.trim() !== '') {
      // Parse plain text
      parsedData = await parseResume(text, 'text/plain');
    } else {
      return NextResponse.json({ error: 'Either text or base64 file is required' }, { status: 400 });
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('❌ Error in parser API route:', error);
    return NextResponse.json({ error: error.message || 'Failed to parse resume' }, { status: 500 });
  }
}
