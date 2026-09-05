import { ClearDatabaseForAccount } from "@/database/DatabaseProvider";
import { initializeAccountManager } from "@/services/shared";
import { useAccountStore } from "@/stores/account";
import { Account, Auth, ServiceAccount } from "@/stores/account/types";

import { EDAvailableAccount } from "./types";

// Shared by the settings switcher and the parent dashboard's child picker.
// Only the selected child id changes in additionals — "token"/"typeCompte" must
// stay the REAL family account's own (needed to refresh later); the selected
// child's synthetic identity is rebuilt from it on every refresh (see refresh.ts).
export async function switchToEDChild(account: Account, service: ServiceAccount, target: EDAvailableAccount): Promise<void> {
  const store = useAccountStore.getState();

  const newAuth: Auth = {
    additionals: {
      ...service.auth.additionals,
      selectedAccountId: target.id,
    },
  };
  store.updateServiceAuthData(service.id, newAuth);
  // Keep className/schoolName in sync too — each child in a family can be in a
  // different class, or even the same child's class changes across school years.
  store.setAccountName(account.id, target.firstName, target.lastName, target.className, target.schoolName);

  // A background sync (e.g. the grades widgets refreshing right after a cold
  // start) can be mid-write on the same rows we're clearing, which WatermelonDB
  // surfaces as a "not cached" error on whichever record it touched. That's a
  // transient snapshot mismatch, not a real failure — retry a few times rather
  // than chase every individual fetch/destroy call that could hit it.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ClearDatabaseForAccount(service.id);
      lastError = undefined;
      break;
    } catch (e) {
      lastError = e;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  if (lastError) {
    throw lastError;
  }

  await initializeAccountManager(account.id);
}
