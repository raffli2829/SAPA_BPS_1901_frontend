import { NextRequest, NextResponse } from 'next/server';
import { DatasetRepo } from '@/lib/repository';

/**
 * GET /api/datasets
 * Returns only PUBLISHED datasets.
 * Query params: ?category=, ?search=
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  let datasets = DatasetRepo.getPublished();

  if (category) {
    datasets = datasets.filter((d) =>
      d.category.toLowerCase().includes(category.toLowerCase())
    );
  }

  if (search) {
    const q = search.toLowerCase();
    datasets = datasets.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    success: true,
    data: datasets.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      category: d.category,
      description: d.description,
      definition: d.definition,
      geographic_scope: d.geographic_scope,
      unit: d.unit,
      source: d.source,
      period_type: d.period_type,
      record_count: d.record_count,
      updated_at: d.updated_at,
    })),
    count: datasets.length,
  });
}
