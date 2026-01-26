import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api/authApi";
import useAuthStore from "../store/useAuthStore";

export const useSession = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);

  const query = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await getMe();
      return res.data.user;
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.isLoading) return;

    if (query.isSuccess && query.data) setUser(query.data);
    if (query.isError) clearUser();
  }, [query.isLoading, query.isSuccess, query.isError, query.data, setUser, clearUser]);

  return query;
};