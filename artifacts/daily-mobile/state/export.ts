import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { dayKey, segments, totals, type Job, type Store } from './model';

export function jobExport(job: Job, data: Store) {
  const sessions = data.sessions.filter(s => s.jobId === job.id);
  const portions = segments(sessions);
  return {
    format: 'Daily job export', version: 1, exportedAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, currency: 'USD', displayName: data.name, job,
    sessions: sessions.map(s => ({ ...s, clockInISO: new Date(s.start).toISOString(), clockOutISO: new Date(s.end).toISOString(), portions: portions.filter(p => p.sessionId === s.id) })),
    daily: [...new Set(portions.map(p => p.date))].map(date => ({ date, ...totals(portions.filter(p => p.date === date)), unit: 'milliseconds; earnings in USD' })),
    calendar: data.days.filter(d => d.jobId === job.id),
    note: 'Estimates before tax. Eight normal hours per job per local day. Historical rates are snapshotted in each session. Tasks and received income/expenses are independent.',
  };
}
export async function exportJob(job: Job, data: Store): Promise<string> {
  const text = JSON.stringify(jobExport(job, data), null, 2);
  const name = `daily-${job.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${dayKey()}.json`;
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') throw new Error('Downloads are not supported in this browser.');
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'Download requested. Check the file in your Downloads folder before deleting; Daily cannot confirm it was saved.';
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device. Your job is unchanged.');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true }); file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save a copy of your Daily job', UTI: 'public.json' });
  return 'Share sheet closed. Daily cannot tell whether you saved or cancelled. Verify your JSON copy before deleting.';
}