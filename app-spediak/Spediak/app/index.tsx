import { Redirect } from 'expo-router';
 
// Redirect to the default tab (e.g., newInspection)
export default function Index() {
  return <Redirect href="/(tabs)/newInspection" />;
} 