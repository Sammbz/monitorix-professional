import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SignInScreen } from '@/components/auth/sign-in-screen';
import { CreateOrganizationScreen } from '@/components/onboarding/create-organization-screen';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { OrganizationProvider, useOrganization } from '@/hooks/use-organization';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { session, initializing } = useAuth();
  const { organization, loading: orgLoading } = useOrganization();
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  if (initializing || !fontsLoaded || (session && orgLoading)) {
    return null;
  }

  function renderScreen() {
    if (!session) return <SignInScreen />;
    if (!organization) return <CreateOrganizationScreen />;
    return <Slot />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {renderScreen()}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <RootNavigator />
      </OrganizationProvider>
    </AuthProvider>
  );
}
