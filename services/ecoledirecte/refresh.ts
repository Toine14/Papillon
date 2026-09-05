import { Client } from "@blockshub/blocksdirecte";

import { useAccountStore } from "@/stores/account";
import { Auth } from "@/stores/account/types";

import { EDAccountKind, getSelectableIdentities, selectIdentityOnClient, serializeEDAccounts } from "./types";

export async function refreshEDAccount(accountId: string, credentials: Auth): Promise<{auth: Auth, account: Client }> {
  const client = new Client();
  // Fallback to "E" for accounts that logged in before parent-account support was added
  // (no typeCompte stored yet) — preserves their existing behavior exactly.
  const typeCompte = (credentials.additionals!["typeCompte"] as EDAccountKind) ?? "E";
  const selectedAccountId = credentials.additionals!["selectedAccountId"] as string | undefined;

  // This refreshes the REAL logged-in identity (a family account for a parent, or
  // the student themselves) — never a synthetic per-child identity, since only the
  // real account's accessToken/typeCompte are valid for the refresh handshake.
  await client.auth.refreshToken(
    credentials.additionals!["username"] as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeCompte as any,
    credentials.additionals!["token"] as string,
    undefined,
    undefined,
    credentials.additionals!["deviceUUID"] as string
  )

  client.auth.setAccount(0);
  const realAccount = client.auth.getAccount();

  // For a family account, the real selectable children live in profile.eleves[],
  // not in Credential.accounts[] — see services/ecoledirecte/types.ts for why.
  const identities = getSelectableIdentities(realAccount);
  const chosen = identities.find(identity => identity.id === selectedAccountId) ?? identities[0];
  const selected = selectIdentityOnClient(client, realAccount, chosen);

  // Keep the Papillon account's display name in sync with whichever identity is
  // active — it should always read as "whoever's data you're currently viewing",
  // not just at initial login/manual switch (e.g. self-heals accounts created
  // before parent-account support, which stored the family's own name).
  const store = useAccountStore.getState();
  const account = store.accounts.find(a => a.services.some(s => s.id === accountId));
  if (account && (account.firstName !== selected.prenom || account.lastName !== selected.nom)) {
    store.setAccountName(account.id, selected.prenom, selected.nom);
  }

  const auth: Auth = {
    additionals: {
      "username": credentials.additionals!["username"],
      // Persist the REAL identity's token/type (needed for the next refresh),
      // not the currently selected child's — those never authenticate a refresh.
      "token": realAccount.accessToken,
      "deviceUUID": credentials.additionals!["deviceUUID"],
      "typeCompte": realAccount.typeCompte,
      "selectedAccountId": chosen.id,
      "availableAccounts": serializeEDAccounts(identities),
    }
  }

  useAccountStore.getState().updateServiceAuthData(accountId, auth);

  return {
    auth,
    account: client
  }
}
