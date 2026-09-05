import type { Account, Client, Module } from "@blockshub/blocksdirecte";

// AccountKind isn't exported by @blockshub/blocksdirecte (missing from its .d.ts),
// so we redeclare the union locally instead of casting blindly at every call site.
export type EDAccountKind = "E" | "1" | "2" | "A" | "P";

export interface EDAvailableAccount {
  id: string;
  typeCompte: EDAccountKind;
  accessToken: string;
  firstName: string;
  lastName: string;
  className?: string;
  schoolName?: string;
  // Which features (NOTES, VIE_SCOLAIRE...) blocksdirecte will consider enabled
  // for this specific identity — see buildAccountForIdentity for why this can't
  // just be inherited from the family account.
  modules?: Module[];
}

// A family/parent account's real children are NOT listed in Credential.accounts[]
// (that array only ever contains the family's own identity). They live in a field
// the library's .d.ts doesn't declare at all: account.profile.eleves[]. Confirmed
// from a real login response captured via the browser's network tab.
interface EDEleveProfile {
  id: number;
  prenom: string;
  nom: string;
  sexe?: string;
  nomEtablissement?: string;
  classe?: { id: number; code: string; libelle: string; estNote: number };
  modules?: Module[];
}

function getFamilyEleves(account: Account): EDEleveProfile[] {
  const eleves = (account.profile as unknown as { eleves?: EDEleveProfile[] })?.eleves;
  return Array.isArray(eleves) ? eleves : [];
}

export function mapEDAccountToAvailable(account: Account): EDAvailableAccount {
  return {
    id: String(account.id),
    typeCompte: account.typeCompte as EDAccountKind,
    accessToken: account.accessToken,
    firstName: account.prenom,
    lastName: account.nom,
    className: account.profile?.classe?.libelle,
    schoolName: account.nomEtablissement,
    modules: account.modules,
  };
}

function mapEleveToAvailable(eleve: EDEleveProfile, familyAccessToken: string): EDAvailableAccount {
  return {
    id: String(eleve.id),
    // A parent viewing one specific child's data does so under the Student ("E")
    // endpoint shape (confirmed: /v3/E/{id}/emploidutemps.awp, /v3/eleves/{id}/timeline.awp),
    // authenticated with the family's own accessToken (same x-token on both calls).
    typeCompte: "E",
    accessToken: familyAccessToken,
    firstName: eleve.prenom,
    lastName: eleve.nom,
    className: eleve.classe?.libelle,
    schoolName: eleve.nomEtablissement,
    // The child's OWN modules, not the family account's — see buildAccountForIdentity.
    modules: eleve.modules,
  };
}

// Returns every identity the logged-in account can view: for a family/parent
// account, that's each child in profile.eleves[]; for anything else (a student
// logging in directly), it's just the account itself.
export function getSelectableIdentities(account: Account): EDAvailableAccount[] {
  const eleves = getFamilyEleves(account);
  if (eleves.length > 0) {
    return eleves.map(eleve => mapEleveToAvailable(eleve, account.accessToken));
  }
  return [mapEDAccountToAvailable(account)];
}

// Builds the Account object blocksdirecte's fetch methods should see as "selected"
// for a given identity. If the identity IS the real logged-in account (a plain
// student login, or a family with no eleves listed), no substitution is needed.
// Otherwise we synthesize a Student-typed account carrying the child's id but the
// family's own accessToken, since the API scopes access by permission, not by a
// per-child token.
//
// Critically, `modules` must come from the CHILD's own list (profile.eleves[].modules),
// not the family account's: blocksdirecte's Modules base class internally checks
// isModuleAvailableForSelectedAccount() against account.modules before letting a
// call through, and recurses indefinitely if it doesn't find what it expects there
// (a real bug in the library) — confirmed by reproducing a
// "RangeError: Maximum call stack size exceeded" in getMark() when this carried the
// family's own modules instead of the child's.
function buildAccountForIdentity(realAccount: Account, identity: EDAvailableAccount): Account {
  if (identity.id === String(realAccount.id) && identity.typeCompte === realAccount.typeCompte) {
    return realAccount;
  }
  return {
    ...realAccount,
    id: Number(identity.id),
    typeCompte: identity.typeCompte as Account["typeCompte"],
    prenom: identity.firstName,
    nom: identity.lastName,
    // Not realAccount.nomEtablissement: for a family account that's the
    // parent's own (blank) establishment field, not the child's school.
    nomEtablissement: identity.schoolName ?? "",
    accessToken: identity.accessToken,
    modules: identity.modules ?? realAccount.modules,
  };
}

// Selects the given identity on the client so every subsequent fetchED* call
// (grades, homework, timetable...) resolves to that identity's data. Reaches into
// blocksdirecte's internal (but runtime-accessible) `credentials.accounts` since
// its public API only supports selecting among Credential.accounts by index.
export function selectIdentityOnClient(
  client: Client,
  realAccount: Account,
  identity: EDAvailableAccount
): Account {
  const target = buildAccountForIdentity(realAccount, identity);
  if (target === realAccount) {
    client.auth.setAccount(0);
    return client.auth.getAccount();
  }

  const credentials = (client.auth as unknown as { credentials: { accounts: Account[] } }).credentials;
  credentials.accounts.push(target);
  client.auth.setAccount(credentials.accounts.length - 1);
  return client.auth.getAccount();
}

export function serializeEDAccounts(accounts: EDAvailableAccount[]): string {
  return JSON.stringify(accounts);
}

export function parseEDAccounts(raw?: string | number): EDAvailableAccount[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
