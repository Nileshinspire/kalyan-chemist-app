import { createContext, useContext } from "react";

const AccountLayoutContext = createContext(false);

export function AccountLayoutProvider({ children }: { children: React.ReactNode }) {
  return (
    <AccountLayoutContext.Provider value={true}>
      {children}
    </AccountLayoutContext.Provider>
  );
}

export function useIsInsideAccountLayout() {
  return useContext(AccountLayoutContext);
}
