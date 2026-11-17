import type { Components } from './src/features/business-types.generated';
type Session = Components['Session'] | undefined;
export interface AdminItem {
  id: string; label: string; href: string; icon: string; group: string;
  kind?: string; description?: string; permissions?: string[];
  organization?: string;
  role?: string;
  audience?: 'public' | 'guest'; footer?: boolean;
}
export const adminGroups: {label:string;items:AdminItem[]}[];
export const adminItems: AdminItem[];
export const queueViews: Record<string,string>;
export const roleLabels: Record<string,string>;
export function canNavigate(item: AdminItem, session: Session): boolean;
export function canOpenAdminPage(pathname:string, search:string, session:Session):boolean;
export function adminPageContext(pathname:string, search?:string, session?:Session): {item?:AdminItem;title:string;detail?:boolean};
export function adminNavLink(item:AdminItem, pathname?:string, className?:string):string;
export function renderAdminNav(label:string, pathname:string):string;
export function renderMasterOptions():string;

export function adminSubjects<T extends {kind:string}>(subjects:T[]):T[];
