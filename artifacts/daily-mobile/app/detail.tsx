import { Redirect, useLocalSearchParams } from 'expo-router';
import { useDaily } from '@/state/DailyContext';
import { TaskFormScreen, MoneyFormScreen, MoneyListScreen } from '@/screens/TasksMoney';
import { JobDetailScreen, TimerScreen, SummaryScreen, HistoryScreen, CalendarScreen } from '@/screens/Work';
import ProfileScreen from '@/screens/Profile';

export default function DetailRoute() {
  const params = useLocalSearchParams<{ view?: string; id?: string }>(), { authenticated } = useDaily();
  if (!authenticated) return <Redirect href="/" />;
  const { view, id } = params;
  switch (view) {
    case 'task-form': return <TaskFormScreen key={id || 'new'} id={id} />;
    case 'income-form': return <MoneyFormScreen key={id || 'new-income'} kind="income" id={id} />;
    case 'expense-form': return <MoneyFormScreen key={id || 'new-expense'} kind="expense" id={id} />;
    case 'income': return <MoneyListScreen kind="income" />;
    case 'expense': return <MoneyListScreen kind="expense" />;
    case 'job': return <JobDetailScreen id={id} />;
    case 'timer': return <TimerScreen />;
    case 'summary': return <SummaryScreen id={id} />;
    case 'history': return <HistoryScreen id={id} />;
    case 'job-calendar': return <CalendarScreen id={id} back />;
    case 'profile': return <ProfileScreen />;
    default: return <Redirect href="/(tabs)" />;
  }
}