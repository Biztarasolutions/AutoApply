import { NextResponse } from 'next/server';
import { parseResume } from '@/lib/ai/parser';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    const parsedData = await parseResume(text);
    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error in parser API route:', error);
    return NextResponse.json({ error: error.message || 'Failed to parse resume' }, { status: 500 });
  }
}
