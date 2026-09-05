import { Papicons } from "@getpapillon/papicons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";

import { EDAvailableAccount, parseEDAccounts } from "@/services/ecoledirecte/types";
import { switchToEDChild } from "@/services/ecoledirecte/switchChild";
import { useAccountStore } from "@/stores/account";
import ClassLabel from "@/ui/components/ClassLabel";
import List from "@/ui/new/List";
import Typography from "@/ui/new/Typography";

export default function SwitchEDChild() {
  const { t } = useTranslation();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const accounts = useAccountStore(state => state.accounts);

  const [switching, setSwitching] = useState(false);

  const account = accounts.find(a =>
    a.services.some(s => s.id === serviceId)
  );
  const service = account?.services.find(s => s.id === serviceId);
  const availableAccounts = parseEDAccounts(
    service?.auth.additionals?.["availableAccounts"]
  );
  const selectedAccountId = service?.auth.additionals?.["selectedAccountId"];

  const switchTo = async (target: EDAvailableAccount) => {
    if (!service || !account || switching || target.id === selectedAccountId) {
      return;
    }

    setSwitching(true);
    try {
      await switchToEDChild(account, service, target);
      router.back();
    } catch {
      Alert.alert(t("Alert_Auth_Error"), t("Settings_SwitchChild_Error"));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <List
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <List.Section>
        {availableAccounts.map(child => (
          <List.Item
            key={child.id}
            onPress={() => switchTo(child)}
            style={{ opacity: switching ? 0.5 : 1 }}
          >
            <Typography variant="title">
              {child.firstName} {child.lastName}
            </Typography>
            <ClassLabel value={child.className} />
            {child.id === selectedAccountId && (
              <List.Trailing>
                <Papicons name="Check" fill="#1788bc" />
              </List.Trailing>
            )}
          </List.Item>
        ))}
      </List.Section>
    </List>
  );
}
