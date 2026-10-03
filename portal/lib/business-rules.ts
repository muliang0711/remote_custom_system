import {shiftTemplates,templateBreak} from './shift-templates';
export type BusinessRule={id:string;version:number;area:string;description:string;parameters:Record<string,unknown>;usage:'Calculation'|'Reference';source:string};
const rule=(id:string,area:string,description:string,parameters:Record<string,unknown>={},usage:BusinessRule['usage']='Reference'):BusinessRule=>({id,version:1,area,description,parameters,usage,source:'User-supplied business rules'});
export const suppliedRules:BusinessRule[]=[
 rule('BR-AL-01','Annual Leave','Only Full-Time and Part-Time employees accrue annual leave.',{eligibleTypes:['Full-Time','Part-Time']},'Calculation'),
 rule('BR-AL-02','Annual Leave','1 hour of annual leave for every 13 hours worked.',{divisor:13},'Calculation'),
 rule('BR-AL-03','Annual Leave','Annual leave = total working hours / 13. The calculation uses the exact division.'),
 rule('BR-AL-04','Annual Leave','Hours × 0.076923 is an approximate equivalent; use hours / 13 for calculations.',{approximateRate:0.076923}),
 rule('BR-AL-05','Annual Leave','Casual employees do not accrue annual leave.',{casualEligible:false}),
 rule('BR-AL-06','Annual Leave Payment','During employment, paid annual leave is subject to tax and superannuation.',{tax:true,superannuation:true}),
 rule('BR-AL-07','Annual Leave Final Pay','Unused annual leave in final pay is subject to tax only; no superannuation, according to the supplied rule.',{tax:true,superannuation:false}),
 rule('BR-PL-01','Personal / Carer / Sick Leave','Only Full-Time and Part-Time employees accrue personal/carer/sick leave.',{eligibleTypes:['Full-Time','Part-Time']},'Calculation'),
 rule('BR-PL-02','Personal / Carer / Sick Leave','Personal leave = total working hours × 0.038462.',{rate:0.038462},'Calculation'),
 rule('BR-PL-03','Personal / Carer / Sick Leave','Each hour worked accrues 0.038462 hours of personal leave.'),
 rule('BR-PL-04','Personal Leave Payment','Personal leave taken during employment is subject to tax and superannuation.',{tax:true,superannuation:true}),
 rule('BR-PL-05','Personal Leave Final Pay','Unused personal/carer/sick leave is not paid out when employment ends.',{payout:false}),
 rule('BR-PL-06','Personal / Carer / Sick Leave','Casual employees do not accrue personal/carer/sick leave.',{casualEligible:false}),
 rule('BR-FP-01','Final Pay','Full-Time and Part-Time final pay is due within 7 days after employment ends.',{days:7}),
 rule('BR-FP-02','Final Pay','Casual employees paid at each engagement must receive final pay at the end of their final engagement.',{trigger:'end_of_final_engagement',condition:'paid_at_end_of_each_engagement'}),
 rule('BR-XERO-01','Xero Setting','Annual Leave in Xero: ordinary hours 152 / 76. Stored as supplied; not used as an accrual multiplier.',{numerator:152,denominator:76}),
 rule('BR-XERO-02','Xero Setting','Personal Leave in Xero: ordinary hours 76 / 76. Stored as supplied; not used as an accrual multiplier.',{numerator:76,denominator:76}),
];
suppliedRules.push(...shiftTemplates.map(t=>rule('BR-FLOOR-'+t.id,'Floor shift templates',`${t.restaurant} · ${t.name} · ${t.days}: ${t.start}–${t.end}. ${t.breakStart?`Unpaid break ${t.breakStart}–${t.breakEnd}.`:'No fixed break supplied.'}`,{...t,breakMinutes:templateBreak(t)},'Calculation')));
export function leaveForHours(hours:number,type:string,rules:BusinessRule[]){const get=(id:string)=>{const r=rules.find(r=>r.id===id&&r.version===1);if(!r)throw Error('Business rule missing: '+id);return r.parameters};const alTypes=get('BR-AL-01').eligibleTypes as string[],plTypes=get('BR-PL-01').eligibleTypes as string[];return {annual:alTypes.includes(type)?hours/Number(get('BR-AL-02').divisor):0,personal:plTypes.includes(type)?hours*Number(get('BR-PL-02').rate):0};}
