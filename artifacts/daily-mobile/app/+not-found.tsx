import { router } from 'expo-router';
import { Empty, Page } from '@/components/daily/UI';
export default function NotFound() {
  return <Page title="A little detour" back><Empty title="This page isn’t here." text="Let’s get back to your day." action={() => router.replace('/')} label="Back to Daily" /></Page>;
}