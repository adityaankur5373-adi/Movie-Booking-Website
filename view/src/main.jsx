
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {BrowserRouter} from 'react-router-dom'
import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1 min = don't refetch again and again
      gcTime: 10 * 60 * 1000,      // keep cache 10 min
      refetchOnWindowFocus: false, // stop auto refetch when tab focus
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')).render(
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
       <BrowserRouter>
    <QueryClientProvider client={queryClient}>
        <Elements stripe={stripePromise}>
    <App />
  </Elements>
</QueryClientProvider>
    </BrowserRouter>
   </GoogleOAuthProvider>
)

