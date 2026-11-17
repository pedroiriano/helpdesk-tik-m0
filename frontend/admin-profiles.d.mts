import type { Components } from './src/features/business-types.generated';
export interface Profile {id:string;label:string;roles:string[];description?:string;permission?:string;href?:string;action?:string}
type Session = Components['Session'] | undefined;
export const primaryProfiles: (Profile & {description:string;permission:string;href:string;action:string})[];
export const specialProfiles: Profile[];
export const roleLabels: Record<string,string>;
export function profileForRole(role:string):Profile | undefined;
export function subjectsForProfile<T extends {role:string;kind:string}>(subjects:T[],id:string):T[];
export function quickLoginSubject<T extends {role:string;kind:string}>(subjects:T[],id:string):T | undefined;
export function delegationOptions(session:Session,organization:string,role:string,currentPermissions?:string[]):string[];
export function standardAccess(session:Session,organization:string,role:string,currentPermissions?:string[]):string[];
export function accessIsAllowed(session:Session,organization:string,role:string,permissions:string[]):boolean;
export function workStart(session:Session):{label:string;description:string;href:string;action:string};
