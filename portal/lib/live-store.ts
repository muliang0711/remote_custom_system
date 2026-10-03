import type {PersonForm} from './person-forms';
import type {BusinessRule} from './business-rules';
import type {RosterWeek} from './roster-model';
import {loadDatabase,saveDatabase} from './people-db';
import type {TimetableState} from './timetable-model';
import type {OfficialEmployee} from './employee-model';
import type {HiringState} from './hiring-model';
import type {State} from './demo-store';
export type LiveState=State & {financeMonthCheckouts?:import('./roster-month').MonthCheckout[];financePayrollInfo?:Record<string,Record<string,{payrollerName:string;remarks:string;updatedAt:string;updatedBy:string}>>;workspaceRevision?:number;trialSettlements?:import('./trial-finance').TrialSettlement[];trialPayments?:import('./trial-finance').TrialPayment[];financeSettlements?:import('./monthly-finance').MonthlySettlement[];financePayments?:import('./monthly-finance').FinancePayment[];financeRecords?:import('./finance-model').FinanceRecord[];availabilityTracking?:{lastAttempt?:string;lastSuccess?:string;error?:string;enabled?:boolean;intervalSeconds?:number};personForms?:Record<string,PersonForm[]>;rosters?:RosterWeek[];businessRules?:BusinessRule[];timetable?:TimetableState;employees?:OfficialEmployee[];hiring?:HiringState;documentNames?:Record<string,string>;processedFormResponses?:string[];formTracking?:Record<string,{verifiedSince:string}>;formsErrors?:string[];lastFormsChecked?:string;folders?:{root:string;templates:string;assignments:string;submissions:string};processedMessages:string[];lastCollected?:string;collectionError?:string;driveSynced?:string;mailPageToken?:string;scanAfter?:string};
export const loadLive=loadDatabase;
export const saveLive=saveDatabase;
const globalState=globalThis as typeof globalThis & {jymQueue?:Promise<unknown>};
export function exclusive<T>(task:()=>Promise<T>):Promise<T>{const next=(globalState.jymQueue||Promise.resolve()).then(task,task);globalState.jymQueue=next.then(()=>{},()=>{});return next}

export function checkWorkspaceRevision(request:Request,state:LiveState){const value=request.headers.get('x-workspace-revision');if(value===null||!/^\d+$/.test(value)||Number(value)!==(state.workspaceRevision||0))throw Error('The workspace changed since you opened it. Reload the page and review your changes before saving.');}
