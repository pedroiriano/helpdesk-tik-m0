import { api, APIError } from './transport';
import type { Components } from './business-types.generated';

type Reference = { id: string; name?: string; active?: boolean };
type Master = { id: string; organization_id?: string; owner_org_id?: string };
type ReferencePage = { items: Reference[]; next_cursor: string | null };

export function hasDeactivationReview(kind: string) {
  return ['organizations', 'divisions', 'teams', 'services'].includes(kind);
}

export async function masterImpact(kind: string, row: Master): Promise<string[]> {
  const organization = kind === 'organizations' ? row.id : row.organization_id ?? row.owner_org_id;
  if (!organization) return ['Organisasi terkait belum tersedia. Periksa struktur dan penugasan sebelum melanjutkan.'];
  const query = new URLSearchParams({organization_id:organization,limit:'5'});
  async function list(label: string, path: string, filters?: Record<string,string>) {
    try {
      const params = new URLSearchParams(query);
      for (const [key,value] of Object.entries(filters ?? {})) params.set(key,value);
      const {items,next_cursor} = await api<ReferencePage>(path+'?'+params);
      const related = items.map(item => item.name
        ? item.name + (item.active === false ? ' (nonaktif)' : '') : 'Jadwal '+item.id.slice(0,8));
      return label+': '+(related.join(', ') || 'Tidak ada dalam cakupan ini')
        +(next_cursor ? ' · masih ada data terkait; buka halaman pengelolaan untuk meninjaunya.' : '.');
    } catch (error) {
      return label+': '+(error instanceof APIError && [403,404].includes(error.status)
        ? 'tidak dapat diperiksa dengan mandat ini.' : 'belum dapat dimuat.');
    }
  }
  if (kind === 'organizations') {
    return Promise.all([
      list('Bidang terkait','/admin/divisions'),
      list('Tim terkait','/admin/teams'),
      list('Layanan milik PD','/admin/services'),
    ]);
  }
  if (kind === 'divisions') {
    return [await list('Tim pada bidang ini','/admin/teams',{division_id:row.id})];
  }
  if (kind === 'teams') {
    return [await list('Roster teknisi terkait','/admin/teams/'+encodeURIComponent(row.id)+'/rosters'),
      'Tinjau aturan penugasan yang memilih tim ini sebelum melanjutkan.'];
  }
  const defaults = await Promise.all(['L1','L2'].map(async tier => {
    try {
      const rule = await api<Components['RoutingRule']>('/admin/services/'+encodeURIComponent(row.id)+'/routing/'+tier);
      return 'Aturan bawaan '+tier+': '+(rule.active ? 'aktif' : 'nonaktif')+' · versi '+rule.version+'.';
    } catch (error) {
      return 'Aturan bawaan '+tier+': '+(error instanceof APIError && error.status === 404
        ? 'tidak ditemukan pada cakupan ini.' : 'belum dapat diperiksa.');
    }
  }));
  return [...defaults,'Untuk aturan per kategori, buka Aturan Penugasan pada detail layanan.'];
}
