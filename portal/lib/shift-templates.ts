export const restaurants=['CARLTONS','SPENCER'] as const;
export const timetableCategories=['Kitchen','Floor','Trial'] as const;
export type Restaurant=typeof restaurants[number];
export type TimetableCategory=typeof timetableCategories[number];
export type ShiftTemplate={id:string;restaurant:Restaurant;category:'Floor';name:string;days:'Every day'|'Weekday'|'Weekend';start:string;end:string;breakStart?:string;breakEnd?:string};
// Both shops use exactly the same Floor times and unpaid breaks, every day.
export const shiftTemplates:ShiftTemplate[]=restaurants.flatMap(restaurant=>[
 {id:restaurant+'-EARLY',restaurant,category:'Floor' as const,name:'Early',days:'Every day' as const,start:'10:30',end:'17:30',breakStart:'14:30',breakEnd:'15:30'},
 {id:restaurant+'-LATE',restaurant,category:'Floor' as const,name:'Late',days:'Every day' as const,start:'18:00',end:'22:00'},
 {id:restaurant+'-FULL',restaurant,category:'Floor' as const,name:'Full day',days:'Every day' as const,start:'12:00',end:'22:00',breakStart:'16:30',breakEnd:'17:30'},
]);
export function templateApplies(t:ShiftTemplate,date:string){const day=new Date(date+'T00:00:00Z').getUTCDay();if(!Number.isFinite(day))return false;return t.days==='Every day'||(t.days==='Weekend'?[0,6].includes(day):![0,6].includes(day));}
const minute=(time:string)=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
export function templateBreak(t:ShiftTemplate){return t.breakStart&&t.breakEnd?minute(t.breakEnd)-minute(t.breakStart):0;}
export function templateHours(t:ShiftTemplate){return (minute(t.end)-minute(t.start)-templateBreak(t))/60;}
