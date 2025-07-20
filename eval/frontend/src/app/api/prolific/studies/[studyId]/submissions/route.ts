import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';
import { prolificService } from '@/lib/services/prolific';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studyId: string }> }
) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { studyId } = await params;
    const data = await prolificService.instance.getSubmissions(studyId);
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching Prolific submissions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studyId: string }> }
) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, submissionIds, rejectionReason } = body;

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const results = await prolificService.instance.processSubmissions({
      action,
      submissionIds,
      rejectionReason
    });

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Error processing Prolific submissions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}