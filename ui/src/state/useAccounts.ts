import React from "react";
import {
  api,
  Account,
  AddAccountRequest,
  UpdateAccountRequest
} from "../api/client";

interface UseAccountsState {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  addAccount: (data: AddAccountRequest) => Promise<void>;
  updateAccount: (
    accountId: number,
    data: UpdateAccountRequest
  ) => Promise<void>;
  toggleAccount: (accountId: number, enabled: boolean) => Promise<void>;
  deleteAccount: (accountId: number) => Promise<void>;
  refetch: () => void;
}

export function useAccounts(): UseAccountsState {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refresh, setRefresh] = React.useState(0);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .getAccounts()
      .then((data) => {
        setAccounts(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Ошибка загрузки аккаунтов");
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load, refresh]);

  const addAccount = React.useCallback(async (data: AddAccountRequest) => {
    await api.addAccount(data);
    setRefresh((r) => r + 1);
  }, []);

  const updateAccount = React.useCallback(
    async (accountId: number, data: UpdateAccountRequest) => {
      await api.updateAccount(accountId, data);
      setRefresh((r) => r + 1);
    },
    []
  );

  const toggleAccount = React.useCallback(
    async (accountId: number, enabled: boolean) => {
      await api.toggleAccount(accountId, enabled);
      setRefresh((r) => r + 1);
    },
    []
  );

  const deleteAccount = React.useCallback(async (accountId: number) => {
    await api.deleteAccount(accountId);
    setRefresh((r) => r + 1);
  }, []);

  return {
    accounts,
    loading,
    error,
    addAccount,
    updateAccount,
    toggleAccount,
    deleteAccount,
    refetch: () => setRefresh((r) => r + 1)
  };
}

