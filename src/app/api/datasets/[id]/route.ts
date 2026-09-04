import { NextRequest, NextResponse } from 'next/server';
import { DatasetRepo } from '@/lib/repository';
import { DataStatus } from '@/lib/types';

/**
 * GET /api/datasets/:id
 * Returns single published dataset detail.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Coba ambil data terbaru dari backend Express
  const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:80').replace(/\/$/, '');
  try {
    const res = await fetch(`${backendUrl}/api/datasets/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'sapa_bps_secure_token_2026' }
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        return NextResponse.json({ success: true, data: json.data });
      }
    }
  } catch (err) {
    // Fallback ke DatasetRepo
  }

  const dataset = DatasetRepo.getById(id);

  if (!dataset) {
    return NextResponse.json(
      { success: false, error: 'Dataset tidak ditemukan.' },
      { status: 404 }
    );
  }

  if (dataset.status !== DataStatus.PUBLISHED) {
    return NextResponse.json(
      { success: false, error: 'Dataset belum dipublikasikan.' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: dataset.id,
      code: dataset.code,
      name: dataset.name,
      category: dataset.category,
      description: dataset.description,
      definition: dataset.definition,
      geographic_scope: dataset.geographic_scope,
      unit: dataset.unit,
      source: dataset.source,
      period_type: dataset.period_type,
      record_count: dataset.record_count,
      updated_at: dataset.updated_at,
    },
  });
}
