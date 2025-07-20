import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { prolificService } from '@/lib/services/prolific';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studyId: string }> }
) {
  try {
    const authResult = await requireAdmin(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { studyId } = await params;
    const study = await prolificService.instance.getStudy(studyId);
    return NextResponse.json(study);

  } catch (error) {
    console.error('Error fetching Prolific study:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ studyId: string }> }
) {
  try {
    const authResult = await requireAdmin(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { studyId } = await params;
    const body = await req.json();
    const { action } = body;

    const updatedStudy = await prolificService.instance.updateStudyStatus(studyId, { action });
    return NextResponse.json(updatedStudy);

  } catch (error) {
    console.error('Error updating Prolific study:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}