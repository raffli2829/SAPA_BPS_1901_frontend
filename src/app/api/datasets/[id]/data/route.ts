import { NextRequest, NextResponse } from 'next/server';
import { DatasetRepo, RecordRepo } from '@/lib/repository';
import { DataStatus } from '@/lib/types';

/**
 * GET /api/datasets/:id/data
 * Returns data records for a published dataset.
 * Query params: ?year=, ?region=, ?indicator=
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const region = searchParams.get('region');
  const indicator = searchParams.get('indicator');

  let records = RecordRepo.getByDataset(id).filter(
    (r) => r.status === DataStatus.PUBLISHED
  );

  if (year) {
    records = records.filter((r) => r.period === year);
  }

  if (region) {
    records = records.filter((r) =>
      r.region.toLowerCase().includes(region.toLowerCase())
    );
  }

  if (indicator) {
    records = records.filter((r) =>
      r.indicator.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  return NextResponse.json({
    success: true,
    dataset: {
      id: dataset.id,
      name: dataset.name,
      code: dataset.code,
      unit: dataset.unit,
    },
    data: records.map((r) => ({
      indicator: r.indicator,
      region: r.region,
      period: r.period,
      value: r.value,
      unit: r.unit,
      source: r.source,
      notes: r.notes,
    })),
    count: records.length,
  });
}
