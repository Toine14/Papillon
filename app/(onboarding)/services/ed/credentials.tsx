
import { Account as EDAccount, Client, DoubleAuthQuestions, DoubleAuthResult, Require2FA } from "@blockshub/blocksdirecte";
import { useTheme, useHeaderHeight } from "expo-router/react-navigation";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
import Reanimated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnboardingBackButton from "@/components/onboarding/OnboardingBackButton";
import OnboardingInput from "@/components/onboarding/OnboardingInput";
import OnboardingScrollingFlatList from "@/components/onboarding/OnboardingScrollingFlatList";
import { EDAvailableAccount, getSelectableIdentities, selectIdentityOnClient, serializeEDAccounts } from "@/services/ecoledirecte/types";
import { useAccountStore } from "@/stores/account";
import { Account, Services } from "@/stores/account/types";
import { useAlert } from "@/ui/components/AlertProvider";
import AnimatedPressable from "@/ui/components/AnimatedPressable";
import Button from "@/ui/components/Button";
import ClassLabel from "@/ui/components/ClassLabel";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/components/Typography";
import uuid from "@/utils/uuid/uuid";
import { ScrollView } from "react-native-gesture-handler";
import LoginView from "../../components/LoginView";

const ANIMATION_DURATION = 170;
export const PlatformPressable = Platform.OS === 'android' ? Pressable : AnimatedPressable;

export default function EDLoginWithCredentials() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;

  const alert = useAlert();
  const { t } = useTranslation();

  const [challengeModalVisible, setChallengeModalVisible] = useState<boolean>(false);
  const [doubleAuthChallenge, setDoubleAuthChallenge] = useState<DoubleAuthQuestions | null>(null);

  const [childSelectionVisible, setChildSelectionVisible] = useState<boolean>(false);
  const [pendingIdentities, setPendingIdentities] = useState<EDAvailableAccount[]>([]);
  const pendingLoginRef = useRef<{
    client: Client;
    realAccount: EDAccount;
    identities: EDAvailableAccount[];
    username: string;
    keys?: DoubleAuthResult;
    device: string;
  } | null>(null);

  const [session, setSession] = useState<Client | null>(null);
  const [token, setToken] = useState<string>();

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const keyboardListeners = useMemo(() => ({
    show: () => {
      "worklet";
      opacity.value = withTiming(0, { duration: ANIMATION_DURATION });
      scale.value = withTiming(0.8, { duration: ANIMATION_DURATION });
    },
    hide: () => {
      "worklet";
      opacity.value = withTiming(1, { duration: ANIMATION_DURATION });
      scale.value = withTiming(1, { duration: ANIMATION_DURATION });
    },
  }), [opacity]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardWillShow", keyboardListeners.show);
    const hideSub = Keyboard.addListener("keyboardWillHide", keyboardListeners.hide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardListeners]);

  const finalizeEDLogin = (
    client: Client,
    realAccount: EDAccount,
    identities: EDAvailableAccount[],
    chosen: EDAvailableAccount,
    username: string,
    keys: DoubleAuthResult | undefined,
    device: string
  ) => {
    const store = useAccountStore.getState();

    const selected = selectIdentityOnClient(client, realAccount, chosen);
    const account: Account = {
      id: device,
      firstName: selected.prenom,
      lastName: selected.nom,
      schoolName: selected.nomEtablissement,
      className: selected.profile?.classe?.libelle,
      services: [
        {
          id: device,
          auth: {
            additionals: {
              "username": username,
              // Persist the REAL identity's token/type (needed for the next
              // refresh), not the currently selected child's.
              "token": realAccount.accessToken,
              "cn": keys?.cn ?? "",
              "cv": keys?.cv ?? "",
              "deviceUUID": device,
              "typeCompte": realAccount.typeCompte,
              "selectedAccountId": chosen.id,
              "availableAccounts": serializeEDAccounts(identities),
            }
          },
          serviceId: Services.ECOLEDIRECTE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.addAccount(account);
    store.setLastUsedAccount(device);

    queueMicrotask(() => {
      router.push({
        pathname: "../end/color",
        params: { accountId: device },
      });
    });
  };

  const handleLogin = async (username: string, password: string, keys?: DoubleAuthResult) => {
    const client = new Client();
    const device = uuid();

    try {
      const tokens = await client.auth.loginUsername(username, password, keys?.cn, keys?.cv, true, device);
      if (tokens) {
        client.auth.setAccount(0);
        const realAccount = client.auth.getAccount();
        // For a family/parent account, the real children live in
        // profile.eleves[], not in tokens.accounts[] — see types.ts.
        const identities = getSelectableIdentities(realAccount);

        if (identities.length > 1) {
          pendingLoginRef.current = { client, realAccount, identities, username, keys, device };
          setPendingIdentities(identities);
          setChildSelectionVisible(true);
        } else {
          finalizeEDLogin(client, realAccount, identities, identities[0], username, keys, device);
        }
      }
    } catch (e) {
      setIsLoggingIn(false);
      if (e instanceof Require2FA) {
        const questions = await client.auth.get2FAQuestion(e.token);
        setDoubleAuthChallenge(questions);
        setSession(client);
        setChallengeModalVisible(true);
        setToken(e.token);
      } else {
        Alert.alert(t("Alert_Auth_Error"), t("ONBOARDING_ALERT_LOGIN_ABORTED"));
      }
    }
  }

  function handleChildSelected(index: number) {
    setChildSelectionVisible(false);
    const pending = pendingLoginRef.current;
    if (!pending) return;
    finalizeEDLogin(pending.client, pending.realAccount, pending.identities, pending.identities[index], pending.username, pending.keys, pending.device);
  }

  const loginED = async (submittedUsername = username, submittedPassword = password) => {
    if (!submittedUsername.trim() || !submittedPassword.trim()) { return; }
    setIsLoggingIn(true);
    Keyboard.dismiss();
    await handleLogin(submittedUsername, submittedPassword);
    setIsLoggingIn(false);
  };

  async function handleChallenge(index: number) {
    setChallengeModalVisible(false);

    if (!session || !doubleAuthChallenge?.propositions?.[index]) { return }
    try {
      const keys = await session.auth.send2FAQuestion(doubleAuthChallenge.propositions[index], token ?? "");
      queueMicrotask(() => void handleLogin(username, password, keys));
    } catch {
      throw new Error("2FA challenge failed");
    }
  }

  function questionComponent({ item, index }: { item: unknown; index: number }) {
    return (
      <Reanimated.View
        entering={FadeInDown.springify().duration(400).delay(index * 80 + 150)}
        exiting={FadeOutUp.springify().duration(400).delay(index * 80 + 150)}
      >
        <PlatformPressable
          onPress={() => {
            handleChallenge(index);
          }}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 10,
            paddingRight: 18,
            borderColor: colors.border,
            borderWidth: 1.5,
            borderRadius: 80,
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Stack
            width={45}
            height={45}
            vAlign="center"
            hAlign="center"
            radius={80}
            backgroundColor={colors.border}
          >
            <Typography variant="h4" color={colors.text}>
              {index + 1}
            </Typography>
          </Stack>
          <Stack gap={0} style={{ width: "80%" }}>
            <Typography nowrap variant="title" style={{ width: "100%" }}>
              {String(item)}
            </Typography>
          </Stack>
        </PlatformPressable>
      </Reanimated.View>
    );
  }

  function childComponent({ item, index }: { item: unknown; index: number }) {
    const identity = item as EDAvailableAccount;
    return (
      <Reanimated.View
        entering={FadeInDown.springify().duration(400).delay(index * 80 + 150)}
        exiting={FadeOutUp.springify().duration(400).delay(index * 80 + 150)}
      >
        <PlatformPressable
          onPress={() => {
            handleChildSelected(index);
          }}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 10,
            paddingRight: 18,
            borderColor: colors.border,
            borderWidth: 1.5,
            borderRadius: 80,
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Stack
            width={45}
            height={45}
            vAlign="center"
            hAlign="center"
            radius={80}
            backgroundColor={colors.border}
          >
            <Typography variant="h4" color={colors.text}>
              {(identity.firstName?.[0] ?? "") + (identity.lastName?.[0] ?? "")}
            </Typography>
          </Stack>
          <Stack gap={0} style={{ width: "80%" }}>
            <Typography nowrap variant="title" style={{ width: "100%" }}>
              {identity.firstName} {identity.lastName}
            </Typography>
            <ClassLabel value={identity.className} />
          </Stack>
        </PlatformPressable>
      </Reanimated.View>
    );
  }

  const headerHeight = useHeaderHeight();
  const finalHeaderHeight = Platform.select({
    android: headerHeight,
    default: insets.top
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1, marginBottom: insets.bottom }} behavior="padding">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: finalHeaderHeight, paddingBottom: insets.bottom }}
      >
        <LoginView
          color="#1788bc"
          serviceName="ÉcoleDirecte"
          serviceIcon={require('@/assets/images/service_ed.png')}
          loading={isLoggingIn}
          onSubmit={(values) => {
            if (!isLoggingIn && values.username && values.password) {
              setUsername(values.username);
              setPassword(values.password);
              loginED(values.username, values.password);
            }
          }}
        />
      </ScrollView>

      <Modal
        visible={challengeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChallengeModalVisible(false)}
      >
        <OnboardingScrollingFlatList
          title={doubleAuthChallenge?.question ?? t("ONBOARDING_DOUBLE_AUTH")}
          color={"#E50052"}
          step={3}
          hasReturnButton={false}
          totalSteps={3}
          elements={doubleAuthChallenge?.propositions ?? []}
          renderItem={questionComponent}
        />
      </Modal>

      <Modal
        visible={childSelectionVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChildSelectionVisible(false)}
      >
        <OnboardingScrollingFlatList
          title={t("ONBOARDING_ED_SELECT_CHILD_TITLE")}
          color={"#1788bc"}
          step={3}
          hasReturnButton={false}
          totalSteps={3}
          elements={pendingIdentities}
          renderItem={childComponent}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
}
