import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginApi } from "../api/authApi";

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginApi,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};