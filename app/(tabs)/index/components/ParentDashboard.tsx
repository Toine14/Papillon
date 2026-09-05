import { useHeaderHeight } from "expo-router/react-navigation";
import React, { useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EDAvailableAccount } from "@/services/ecoledirecte/types";
import { switchToEDChild } from "@/services/ecoledirecte/switchChild";
import { useParentViewStore } from "@/stores/parentView";
import { Account, ServiceAccount } from "@/stores/account/types";
import Avatar from "@/ui/components/Avatar";
import ClassLabel from "@/ui/components/ClassLabel";
import List from "@/ui/new/List";
import Stack from "@/ui/components/Stack";
import Typography from "@/ui/new/Typography";
import { getInitials } from "@/utils/chats/initials";

const ParentDashboard = ({
  account,
  service,
  identities,
}: {
  account: Account;
  service: ServiceAccount;
  identities: EDAvailableAccount[];
}) => {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const enterChild = useParentViewStore(state => state.enterChild);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const selectedAccountId = service.auth.additionals?.["selectedAccountId"];

  const selectChild = async (child: EDAvailableAccount) => {
    if (switchingId) return;

    // The app already auto-selects a fallback child on every refresh (see
    // refresh.ts) — if that's the one being tapped, there's nothing to switch:
    // just enter its view. Actually running the switch here would clear and
    // re-sync the local DB while that same automatic refresh may still be
    // writing to it, which is what caused the WatermelonDB races we saw.
    if (child.id === selectedAccountId) {
      enterChild(child.id);
      return;
    }

    setSwitchingId(child.id);
    try {
      await switchToEDChild(account, service, child);
      enterChild(child.id);
    } catch {
      Alert.alert("Erreur", "Impossible d'accéder aux données de cet enfant pour le moment.");
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <List
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: 16,
        paddingTop: headerHeight + insets.top,
        gap: 16,
      }}
    >
      <Stack padding={[4, 0]} style={{ maxWidth: 500 }}>
        <Typography variant="h2">Espace famille</Typography>
        <Typography variant="body1" color="textSecondary">
          Choisis l'enfant dont tu veux consulter les notes, l'emploi du temps et les devoirs.
        </Typography>
      </Stack>

      <List.Section>
        {identities.map(child => (
          <List.Item
            key={child.id}
            onPress={() => selectChild(child)}
            style={{ opacity: switchingId && switchingId !== child.id ? 0.5 : 1 }}
          >
            <List.Leading>
              <Avatar size={38} initials={getInitials(`${child.firstName} ${child.lastName}`)} />
            </List.Leading>
            <Typography variant="title">
              {child.firstName} {child.lastName}
            </Typography>
            <ClassLabel value={child.className} />
          </List.Item>
        ))}
      </List.Section>
    </List>
  );
};

export default ParentDashboard;
