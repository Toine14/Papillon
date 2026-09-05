import { Papicons } from '@getpapillon/papicons';
import { useIsFocused } from "expo-router/react-navigation";
import { useRouter } from 'expo-router';
import { t } from 'i18next';
import React from 'react';
import { FlatList, Platform, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseEDAccounts } from '@/services/ecoledirecte/types';
import { useAccountStore } from '@/stores/account';
import { Services } from '@/stores/account/types';
import { useParentViewStore } from '@/stores/parentView';
import { useSettingsStore } from '@/stores/settings';
import { checkConsent } from '@/utils/logger/consent';

import HomeHeader from './atoms/HomeHeader';
import HomeTopBar from './atoms/HomeTopBar';
import Wallpaper from './atoms/Wallpaper';
import ParentDashboard from './components/ParentDashboard';
import HomeWidget, { HomeWidgetItem } from './components/HomeWidget';
import { useHomeData } from './hooks/useHomeData';
import { useTimetableWidgetData } from './hooks/useTimetableWidgetData';
import { useTimetableWidgetTitle } from './hooks/useTimetableWidgetTitle';
import HomeTimeTableWidget from './widgets/timetable';
import GradesWidget from './widgets/Grades';
import MaskedView from '@react-native-masked-view/masked-view';
import LinearGradient from 'react-native-linear-gradient';
import MainTabErrorBoundary from '@/ui/components/MainTabErrorBoundary';

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = insets.bottom + 16;
  const focused = useIsFocused();

  // Account
  const store = useAccountStore();
  const accounts = useAccountStore((state) => state.accounts);
  const account = accounts.find(a => a.id === store.lastUsedAccount);
  const router = useRouter();
  const welcomeModalSeen = useSettingsStore(state => state.personalization.welcomeModalSeen);
  const mutateSettings = useSettingsStore(state => state.mutateProperty);

  React.useEffect(() => {
    if (accounts.length === 0) {
      router.replace("/(onboarding)/welcome");
      return;
    }

    if (account && account.transport === undefined) {
      store.initializeTransport(account.schoolName);
    }
  }, [account, accounts.length, router, store]);

  React.useEffect(() => {
    checkConsent().then(consent => {
      if (!consent.given) {
        router.push("../consent");
      }
    });
  }, []);

  useHomeData();
  const { courses } = useTimetableWidgetData();
  const timetableTitle = useTimetableWidgetTitle(courses);

  const [gradesWidgetHidden, setGradesWidgetHidden] = React.useState(true);

  const renderTimeTable = React.useCallback(() => <HomeTimeTableWidget />, []);
  const renderGrades = React.useCallback(
    () => <GradesWidget onEmptyStateChange={setGradesWidgetHidden} />,
    []
  );

  const data: HomeWidgetItem[] = React.useMemo(() => [
    {
      icon: <Papicons name={"Calendar"} />,
      title: timetableTitle,
      redirect: "(tabs)/calendar",
      render: renderTimeTable
    },
    {
      icon: <Papicons name={"Grades"} />,
      title: t("Home_Widget_Grades_Average"),
      redirect: "(tabs)/grades",
      hidden: gradesWidgetHidden,
      render: renderGrades
    }
  ], [renderTimeTable, renderGrades, gradesWidgetHidden, timetableTitle]);

  React.useEffect(() => {
    if (!account || welcomeModalSeen) {
      return;
    }

    mutateSettings("personalization", { welcomeModalSeen: true });
    router.navigate("/(modals)/welcome");
  }, [account, mutateSettings, router, welcomeModalSeen]);

  const edService = account?.services.find(s => s.serviceId === Services.ECOLEDIRECTE);
  const edTypeCompte = edService?.auth.additionals?.["typeCompte"];
  const isParentAccount = edTypeCompte === "1" || edTypeCompte === "2";
  const enteredChildId = useParentViewStore(state => state.enteredChildId);

  if (isParentAccount && !enteredChildId && account && edService) {
    return (
      <>
        <Wallpaper />
        <ParentDashboard
          account={account}
          service={edService}
          identities={parseEDAccounts(edService.auth.additionals?.["availableAccounts"])}
        />
      </>
    );
  }

  return (
    <>
      <Wallpaper />
      <HomeTopBar />
      {focused && <StatusBar translucent animated barStyle={'light-content'} />}
      <HomeViewContainer key={"home"}>
        <FlatList
          renderItem={({ item }) => <HomeWidget item={item} />}
          keyExtractor={(item) => item.title}
          ListHeaderComponent={<HomeHeader />}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: Platform.OS === 'ios' ? bottomTabBarHeight : 16,
            paddingHorizontal: 16,
            flexGrow: 1,
            gap: 12,
            marginTop: 6,
            paddingLeft: insets.left + 16,
            width: '100%',
            maxWidth: 670,
            marginHorizontal: 'auto',
          }}
          data={data}
        />
      </HomeViewContainer>
    </>
  );
};

const HomeViewContainer = ({ children }) => {
  const insets = useSafeAreaInsets();

  return (
    <MaskedView
      maskElement={
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <LinearGradient
            colors={['#ff000022', 'white']}
            locations={[0.5, 1]}
            style={{ height: insets.top + 68 }}
          />
          <View style={{ flex: 1, backgroundColor: 'white' }} />
        </View>
      }
      style={{ flex: 1 }}
    >
      {children}
    </MaskedView>
  )
}

const HomeScreenWithBoundary = () => (
  <MainTabErrorBoundary>
    <HomeScreen />
  </MainTabErrorBoundary>
);

export default HomeScreenWithBoundary;
