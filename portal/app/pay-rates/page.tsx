'use client';
import {useState} from 'react';
import {PortalSidebar} from '@/components/portal-sidebar';
import {SidebarProvider,SidebarTrigger} from '@/components/ui/sidebar';
import {payRateVersion,payEmploymentTypes,payAgeGroups,payLevels,payDayTypes,hourlyRateCents,formatHourlyRate,type PayEmploymentType,type PayAgeGroup} from '@/lib/pay-rates';
import styles from './pay-rates.module.css';

export default function PayRates(){
  const [employment,setEmployment]=useState<PayEmploymentType>('Full-time/Part-time');
  const [age,setAge]=useState<PayAgeGroup>('20+');
  const ageLabel=age==='20+'?'20+ / Adult':age==='Under 17'?'Under 17':`Age ${age}`;
  return <SidebarProvider><PortalSidebar active="pay-rates"/><div className="workspace">
    <header className="topbar"><div><SidebarTrigger/><span>Employee</span><span>/</span><strong>Pay Rate Table</strong></div><span className="demo-badge">AUD / HOUR</span></header>
    <main className={styles.page}>
      <div className="page-heading"><div><p className="eyebrow">EMPLOYEE</p><h1>Pay Rate Table</h1><p>Find the hourly rate by employment type, age, classification level and day type.</p></div></div>
      <div className={styles.version}><strong>{payRateVersion.award}</strong><span>Effective <time dateTime={payRateVersion.effectiveFrom}>01/07/2026</time></span></div>
      <section className={`panel ${styles.filters}`} aria-label="Pay rate filters">
        <label htmlFor="rate-employment">Employment Type<select id="rate-employment" value={employment} onChange={e=>setEmployment(e.target.value as PayEmploymentType)}>{payEmploymentTypes.map(type=><option key={type}>{type}</option>)}</select><small>Full-time and Part-time share the same rates.</small></label>
        <label htmlFor="rate-age">Age Group<select id="rate-age" value={age} onChange={e=>setAge(e.target.value as PayAgeGroup)}>{payAgeGroups.map(group=><option key={group} value={group}>{group==='20+'?'20+ / Adult':group==='Under 17'?group:`Age ${group}`}</option>)}</select><small>Age 20 uses the adult rate.</small></label>
      </section>
      <section className={`panel ${styles.rates}`} aria-labelledby="rate-heading">
        <div className={styles.tableHeading}><div><p className="eyebrow">HOURLY RATES</p><h2 id="rate-heading">{employment} <span>· {ageLabel}</span></h2></div><span className={styles.unit}>AUD per hour</span></div>
        <p className={styles.srOnly} role="status" aria-live="polite">Showing {employment}, {ageLabel}, Level 1 to Level 3.</p>
        <div className={styles.tableScroll} role="region" aria-label="Hourly pay rates by level and day" tabIndex={0}>
          <table><caption className={styles.srOnly}>{employment}, {ageLabel} — effective 1 July 2026. All rates in AUD per hour.</caption><thead><tr><th scope="col">Classification</th>{payDayTypes.map(day=><th scope="col" key={day}>{day}{day==='Weekday'&&<small>Monday–Friday</small>}</th>)}</tr></thead>
            <tbody>{payLevels.map(level=><tr key={level}><th scope="row"><span className={styles.level}>Level {level}</span></th>{payDayTypes.map(day=><td key={day}>{formatHourlyRate(hourlyRateCents(employment,level,age,day))}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className={styles.tableNote}>Rates are shown to two decimal places for the selected group.</p>
      </section>
      <p className={styles.scope}>Hourly rate lookup only. Worked hours, weekly salary, overtime, leave, breaks and roster assignments are outside this table.</p>
    </main>
  </div></SidebarProvider>;
}
