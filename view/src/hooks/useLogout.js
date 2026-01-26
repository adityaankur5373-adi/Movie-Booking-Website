import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logoutApi } from "../api/authApi";
import useAuthStore from "../store/useAuthStore";

export const useLogout = () => {
  const queryClient = useQueryClient();
  const clearUser = useAuthStore((s) => s.clearUser);

  return useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      clearUser();
      queryClient.removeQueries({ queryKey: ["me"] });
    },
    onError: () => {
      clearUser();
      queryClient.removeQueries({ queryKey: ["me"] });
    },
  });
};